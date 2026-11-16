#![no_std]
//! LotPassport: registro on-chain del pasaporte de un lote de café o cacao.
//!
//! Guarda la raíz Merkle de las credenciales del lote (identidad, parcelas,
//! resultado de deforestación) y las atestaciones de cada hito logístico
//! (acopio, embarque, llegada). Un hito solo puede atestarse si lo firma un
//! verificador autorizado para ese hito y si el hito anterior ya existe.
//!
//! El servicio que aprueba hitos en el escrow (Trustless Work) consulta
//! `is_attested` antes de aprobar: sin prueba, no hay liberación de pago.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, BytesN, Env,
    String,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const TTL_EXTEND_TO: u32 = 180 * DAY_IN_LEDGERS;

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Milestone {
    Acopio,
    Embarque,
    Llegada,
}

impl Milestone {
    fn previous(self) -> Option<Milestone> {
        match self {
            Milestone::Acopio => None,
            Milestone::Embarque => Some(Milestone::Acopio),
            Milestone::Llegada => Some(Milestone::Embarque),
        }
    }
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Lot {
    pub cooperative: Address,
    /// Raíz Merkle de las credenciales del pasaporte (emitidas en ACTA).
    pub passport_root: BytesN<32>,
    pub parcels: u32,
    pub bags: u32,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Attestation {
    pub issuer: Address,
    /// Hash de la evidencia (por ejemplo, del conocimiento de embarque).
    pub evidence_hash: BytesN<32>,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Issuer(Address, Milestone),
    Lot(String),
    Attestation(String, Milestone),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    LotAlreadyExists = 1,
    LotNotFound = 2,
    IssuerNotAuthorized = 3,
    AlreadyAttested = 4,
    PreviousMilestoneMissing = 5,
    InvalidLot = 6,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IssuerSet {
    #[topic]
    pub issuer: Address,
    pub milestone: Milestone,
    pub allowed: bool,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LotCreated {
    #[topic]
    pub lot_id: String,
    pub passport_root: BytesN<32>,
    pub parcels: u32,
    pub bags: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MilestoneAttested {
    #[topic]
    pub lot_id: String,
    pub milestone: Milestone,
    pub issuer: Address,
    pub evidence_hash: BytesN<32>,
}

#[contract]
pub struct LotPassport;

#[contractimpl]
impl LotPassport {
    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    /// Autoriza (o revoca) a un verificador para firmar un hito concreto.
    pub fn set_issuer(env: Env, issuer: Address, milestone: Milestone, allowed: bool) {
        Self::admin(env.clone()).require_auth();
        let key = DataKey::Issuer(issuer.clone(), milestone);
        if allowed {
            env.storage().persistent().set(&key, &true);
            env.storage()
                .persistent()
                .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
        } else {
            env.storage().persistent().remove(&key);
        }
        IssuerSet {
            issuer,
            milestone,
            allowed,
        }
        .publish(&env);
    }

    pub fn is_issuer(env: Env, issuer: Address, milestone: Milestone) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Issuer(issuer, milestone))
            .unwrap_or(false)
    }

    /// La cooperativa registra un lote con la raíz Merkle de su pasaporte.
    pub fn create_lot(
        env: Env,
        cooperative: Address,
        lot_id: String,
        passport_root: BytesN<32>,
        parcels: u32,
        bags: u32,
    ) -> Result<Lot, Error> {
        cooperative.require_auth();
        if parcels == 0 || bags == 0 || lot_id.len() == 0 {
            return Err(Error::InvalidLot);
        }
        let key = DataKey::Lot(lot_id.clone());
        if env.storage().persistent().has(&key) {
            return Err(Error::LotAlreadyExists);
        }
        let lot = Lot {
            cooperative,
            passport_root,
            parcels,
            bags,
            created_at: env.ledger().timestamp(),
        };
        env.storage().persistent().set(&key, &lot);
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
        LotCreated {
            lot_id,
            passport_root: lot.passport_root.clone(),
            parcels,
            bags,
        }
        .publish(&env);
        Ok(lot)
    }

    pub fn get_lot(env: Env, lot_id: String) -> Result<Lot, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Lot(lot_id))
            .ok_or(Error::LotNotFound)
    }

    /// Un verificador autorizado atesta un hito con el hash de su evidencia.
    /// Los hitos son secuenciales: acopio, embarque, llegada.
    pub fn attest(
        env: Env,
        issuer: Address,
        lot_id: String,
        milestone: Milestone,
        evidence_hash: BytesN<32>,
    ) -> Result<Attestation, Error> {
        issuer.require_auth();
        if !env
            .storage()
            .persistent()
            .has(&DataKey::Lot(lot_id.clone()))
        {
            return Err(Error::LotNotFound);
        }
        if !Self::is_issuer(env.clone(), issuer.clone(), milestone) {
            return Err(Error::IssuerNotAuthorized);
        }
        let key = DataKey::Attestation(lot_id.clone(), milestone);
        if env.storage().persistent().has(&key) {
            return Err(Error::AlreadyAttested);
        }
        if let Some(prev) = milestone.previous() {
            if !Self::is_attested(env.clone(), lot_id.clone(), prev) {
                return Err(Error::PreviousMilestoneMissing);
            }
        }
        let attestation = Attestation {
            issuer: issuer.clone(),
            evidence_hash,
            timestamp: env.ledger().timestamp(),
        };
        env.storage().persistent().set(&key, &attestation);
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
        MilestoneAttested {
            lot_id,
            milestone,
            issuer,
            evidence_hash: attestation.evidence_hash.clone(),
        }
        .publish(&env);
        Ok(attestation)
    }

    pub fn is_attested(env: Env, lot_id: String, milestone: Milestone) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Attestation(lot_id, milestone))
    }

    pub fn get_attestation(env: Env, lot_id: String, milestone: Milestone) -> Option<Attestation> {
        env.storage()
            .persistent()
            .get(&DataKey::Attestation(lot_id, milestone))
    }

    /// Próximo hito pendiente del lote, o `None` si el lote está completo.
    pub fn next_milestone(env: Env, lot_id: String) -> Result<Option<Milestone>, Error> {
        if !env
            .storage()
            .persistent()
            .has(&DataKey::Lot(lot_id.clone()))
        {
            return Err(Error::LotNotFound);
        }
        for m in [Milestone::Acopio, Milestone::Embarque, Milestone::Llegada] {
            if !Self::is_attested(env.clone(), lot_id.clone(), m) {
                return Ok(Some(m));
            }
        }
        Ok(None)
    }
}

#[cfg(test)]
mod test;
