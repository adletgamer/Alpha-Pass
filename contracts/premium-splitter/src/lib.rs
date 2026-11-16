#![no_std]
//! PremiumSplitter: reparte el premio de un lote entre los productores
//! según pesos (por ejemplo, sacos aportados por cada parcela).
//! Funciona con cualquier activo de Stellar vía su Stellar Asset Contract
//! (USDC o EURC). El resto por redondeo va al último productor.

use soroban_sdk::{contract, contracterror, contractevent, contractimpl, token, Address, Env, Vec};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NoRecipients = 1,
    LengthMismatch = 2,
    ZeroWeight = 3,
    InvalidAmount = 4,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PremiumSplit {
    #[topic]
    pub token: Address,
    pub from: Address,
    pub amount: i128,
}

#[contract]
pub struct PremiumSplitter;

#[contractimpl]
impl PremiumSplitter {
    /// Transfiere `amount` de `from` a `recipients` en proporción a `weights`.
    /// Devuelve el monto enviado a cada productor.
    pub fn split(
        env: Env,
        token: Address,
        from: Address,
        recipients: Vec<Address>,
        weights: Vec<u32>,
        amount: i128,
    ) -> Result<Vec<i128>, Error> {
        from.require_auth();
        if recipients.is_empty() {
            return Err(Error::NoRecipients);
        }
        if recipients.len() != weights.len() {
            return Err(Error::LengthMismatch);
        }
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let mut total: i128 = 0;
        for w in weights.iter() {
            if w == 0 {
                return Err(Error::ZeroWeight);
            }
            total += w as i128;
        }

        let client = token::Client::new(&env, &token);
        let mut shares = Vec::new(&env);
        let mut sent: i128 = 0;
        let last = recipients.len() - 1;
        for i in 0..recipients.len() {
            let to = recipients.get(i).unwrap();
            let share = if i == last {
                amount - sent
            } else {
                amount * weights.get(i).unwrap() as i128 / total
            };
            if share > 0 {
                client.transfer(&from, &to, &share);
            }
            sent += share;
            shares.push_back(share);
        }
        PremiumSplit {
            token,
            from,
            amount,
        }
        .publish(&env);
        Ok(shares)
    }
}

#[cfg(test)]
mod test {
    extern crate std;
    use super::*;
    use soroban_sdk::{testutils::Address as _, token::StellarAssetClient, vec, Address, Env};

    #[test]
    fn splits_by_weight_and_sends_remainder_to_last() {
        let env = Env::default();
        env.mock_all_auths();
        let issuer = Address::generate(&env);
        let sac = env.register_stellar_asset_contract_v2(issuer);
        let usdc = sac.address();
        let coop = Address::generate(&env);
        StellarAssetClient::new(&env, &usdc).mint(&coop, &1_000_000);

        let id = env.register(PremiumSplitter, ());
        let client = PremiumSplitterClient::new(&env, &id);
        let a = Address::generate(&env);
        let b = Address::generate(&env);
        let c = Address::generate(&env);
        // Sacos aportados: 14, 12, 19 -> total 45; premio 1000 unidades.
        let shares = client.split(
            &usdc,
            &coop,
            &vec![&env, a.clone(), b.clone(), c.clone()],
            &vec![&env, 14u32, 12u32, 19u32],
            &1000,
        );
        assert_eq!(shares, vec![&env, 311i128, 266i128, 423i128]);
        let t = token::Client::new(&env, &usdc);
        assert_eq!(t.balance(&a), 311);
        assert_eq!(t.balance(&c), 423);
        assert_eq!(t.balance(&coop), 1_000_000 - 1000);
    }

    #[test]
    fn rejects_mismatched_inputs() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(PremiumSplitter, ());
        let client = PremiumSplitterClient::new(&env, &id);
        let token = Address::generate(&env);
        let coop = Address::generate(&env);
        let a = Address::generate(&env);
        let res = client.try_split(&token, &coop, &vec![&env, a], &vec![&env, 1u32, 2u32], &10);
        assert_eq!(res, Err(Ok(Error::LengthMismatch)));
    }
}
