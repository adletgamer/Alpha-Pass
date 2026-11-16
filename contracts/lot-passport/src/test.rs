#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, String};

struct Setup {
    env: Env,
    client: LotPassportClient<'static>,
    coop: Address,
    warehouse: Address,
    forwarder: Address,
    buyer: Address,
}

fn setup() -> Setup {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(LotPassport, (admin.clone(),));
    let client = LotPassportClient::new(&env, &contract_id);
    let coop = Address::generate(&env);
    let warehouse = Address::generate(&env);
    let forwarder = Address::generate(&env);
    let buyer = Address::generate(&env);
    client.set_issuer(&warehouse, &Milestone::Acopio, &true);
    client.set_issuer(&forwarder, &Milestone::Embarque, &true);
    client.set_issuer(&buyer, &Milestone::Llegada, &true);
    Setup {
        env,
        client,
        coop,
        warehouse,
        forwarder,
        buyer,
    }
}

fn lot_id(env: &Env) -> String {
    String::from_str(env, "2026-JAE-014")
}

fn hash(env: &Env, byte: u8) -> BytesN<32> {
    BytesN::from_array(env, &[byte; 32])
}

#[test]
fn full_flow_attests_all_milestones_in_order() {
    let s = setup();
    let id = lot_id(&s.env);
    let lot = s.client.create_lot(&s.coop, &id, &hash(&s.env, 1), &4, &60);
    assert_eq!(lot.parcels, 4);
    assert_eq!(s.client.next_milestone(&id), Some(Milestone::Acopio));

    s.client
        .attest(&s.warehouse, &id, &Milestone::Acopio, &hash(&s.env, 2));
    s.client
        .attest(&s.forwarder, &id, &Milestone::Embarque, &hash(&s.env, 3));
    s.client
        .attest(&s.buyer, &id, &Milestone::Llegada, &hash(&s.env, 4));

    assert!(s.client.is_attested(&id, &Milestone::Llegada));
    assert_eq!(s.client.next_milestone(&id), None);
    let att = s.client.get_attestation(&id, &Milestone::Embarque).unwrap();
    assert_eq!(att.issuer, s.forwarder);
    assert_eq!(att.evidence_hash, hash(&s.env, 3));
}

#[test]
fn shipment_without_collection_is_rejected() {
    let s = setup();
    let id = lot_id(&s.env);
    s.client.create_lot(&s.coop, &id, &hash(&s.env, 1), &4, &60);
    let res = s
        .client
        .try_attest(&s.forwarder, &id, &Milestone::Embarque, &hash(&s.env, 3));
    assert_eq!(res, Err(Ok(Error::PreviousMilestoneMissing)));
    assert!(!s.client.is_attested(&id, &Milestone::Embarque));
}

#[test]
fn unauthorized_issuer_is_rejected() {
    let s = setup();
    let id = lot_id(&s.env);
    s.client.create_lot(&s.coop, &id, &hash(&s.env, 1), &4, &60);
    // El almacén no puede firmar el embarque.
    let res = s
        .client
        .try_attest(&s.warehouse, &id, &Milestone::Embarque, &hash(&s.env, 3));
    assert_eq!(res, Err(Ok(Error::IssuerNotAuthorized)));
}

#[test]
fn milestone_cannot_be_attested_twice() {
    let s = setup();
    let id = lot_id(&s.env);
    s.client.create_lot(&s.coop, &id, &hash(&s.env, 1), &4, &60);
    s.client
        .attest(&s.warehouse, &id, &Milestone::Acopio, &hash(&s.env, 2));
    let res = s
        .client
        .try_attest(&s.warehouse, &id, &Milestone::Acopio, &hash(&s.env, 9));
    assert_eq!(res, Err(Ok(Error::AlreadyAttested)));
}

#[test]
fn duplicate_or_invalid_lots_are_rejected() {
    let s = setup();
    let id = lot_id(&s.env);
    s.client.create_lot(&s.coop, &id, &hash(&s.env, 1), &4, &60);
    let dup = s
        .client
        .try_create_lot(&s.coop, &id, &hash(&s.env, 1), &4, &60);
    assert_eq!(dup, Err(Ok(Error::LotAlreadyExists)));
    let other = String::from_str(&s.env, "2026-JAE-015");
    let empty = s
        .client
        .try_create_lot(&s.coop, &other, &hash(&s.env, 1), &0, &60);
    assert_eq!(empty, Err(Ok(Error::InvalidLot)));
}

#[test]
fn revoked_issuer_cannot_attest() {
    let s = setup();
    let id = lot_id(&s.env);
    s.client.create_lot(&s.coop, &id, &hash(&s.env, 1), &4, &60);
    s.client
        .set_issuer(&s.warehouse, &Milestone::Acopio, &false);
    let res = s
        .client
        .try_attest(&s.warehouse, &id, &Milestone::Acopio, &hash(&s.env, 2));
    assert_eq!(res, Err(Ok(Error::IssuerNotAuthorized)));
}

#[test]
fn unknown_lot_is_rejected() {
    let s = setup();
    let res = s.client.try_attest(
        &s.warehouse,
        &lot_id(&s.env),
        &Milestone::Acopio,
        &hash(&s.env, 2),
    );
    assert_eq!(res, Err(Ok(Error::LotNotFound)));
}
