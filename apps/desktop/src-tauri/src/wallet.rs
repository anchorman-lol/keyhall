use nostr::nips::nip47::{
    Nip47Ciphers, NostrWalletConnectUri, PayInvoiceRequest, Request, Response,
};
use nostr::prelude::Event;
use serde_json::{Value, json};

pub fn parse(uri: &str) -> Result<NostrWalletConnectUri, String> {
    NostrWalletConnectUri::parse(uri.trim())
        .map_err(|_| "That is not a nostr+walletconnect:// connection string".into())
}

pub fn summary(uri: &NostrWalletConnectUri) -> String {
    let relay = uri.relays[0].as_str_without_trailing_slash();
    let host = relay.split("://").nth(1).unwrap_or(relay);
    uri.lud16.clone().unwrap_or_else(|| host.to_string())
}

/// The secret stays here: the launcher only relays the encrypted request and reply.
pub fn pay_request(uri: &NostrWalletConnectUri, invoice: &str) -> Result<Value, String> {
    let event = Request::pay_invoice(PayInvoiceRequest::new(invoice))
        .to_event(uri, Nip47Ciphers::NIP04)
        .map_err(|e| e.to_string())?;
    Ok(json!({
        "event": event,
        "relay": uri.relays[0].as_str_without_trailing_slash(),
        "wallet": uri.public_key.to_hex(),
    }))
}

pub fn pay_result(uri: &NostrWalletConnectUri, reply: &Event) -> Result<String, String> {
    let nip44 = reply
        .tags
        .iter()
        .any(|t| t.as_slice() == ["encryption", "nip44_v2"]);
    let cipher = if nip44 {
        Nip47Ciphers::NIP44V2
    } else {
        Nip47Ciphers::NIP04
    };
    let response = Response::from_event(uri, reply, cipher).map_err(|e| e.to_string())?;
    if let Some(error) = response.error {
        return Err(format!("The wallet refused: {}", error.message));
    }
    Ok(response
        .to_pay_invoice()
        .map_err(|e| e.to_string())?
        .preimage)
}

#[cfg(test)]
mod tests {
    use super::*;
    use nostr::nips::nip04;
    use nostr::prelude::{EventBuilder, FinalizeEvent, Keys, Kind, Tag, ToBech32};

    fn connection() -> (Keys, String) {
        let wallet = Keys::generate();
        let app = Keys::generate();
        let uri = format!(
            "nostr+walletconnect://{}?relay=wss%3A%2F%2Frelay.example%2Fv1&secret={}&lud16=me%40wallet.example",
            wallet.public_key().to_hex(),
            app.secret_key().to_secret_hex()
        );
        (wallet, uri)
    }

    fn reply(wallet: &Keys, request: &Event, body: Value) -> Event {
        let content =
            nip04::encrypt(wallet.secret_key(), &request.pubkey, body.to_string()).unwrap();
        EventBuilder::new(Kind::WalletConnectResponse, content)
            .tag(Tag::public_key(request.pubkey))
            .tag(Tag::event(request.id))
            .finalize(wallet)
            .unwrap()
    }

    #[test]
    fn rejects_anything_but_an_nwc_uri() {
        assert!(parse("lnurl1dp68gurn8ghj7").is_err());
        assert!(parse(&Keys::generate().secret_key().to_bech32().unwrap()).is_err());
        let (_, uri) = connection();
        assert_eq!(summary(&parse(&uri).unwrap()), "me@wallet.example");
    }

    #[test]
    fn pays_an_invoice_through_the_wallet() {
        let (wallet, uri) = connection();
        let uri = parse(&uri).unwrap();
        let request = pay_request(&uri, "lnbc10n1xyz").unwrap();
        assert_eq!(request["relay"], "wss://relay.example/v1");
        assert_eq!(request["wallet"], wallet.public_key().to_hex());
        let event: Event = serde_json::from_value(request["event"].clone()).unwrap();
        assert!(event.verify().is_ok());
        assert_eq!(event.kind, Kind::WalletConnectRequest);
        let body = nip04::decrypt(wallet.secret_key(), &event.pubkey, &event.content).unwrap();
        assert!(body.contains("\"invoice\":\"lnbc10n1xyz\""));

        let paid = json!({"result_type": "pay_invoice", "result": {"preimage": "abc"}});
        assert_eq!(
            pay_result(&uri, &reply(&wallet, &event, paid)),
            Ok("abc".into())
        );

        let refused = json!({"result_type": "pay_invoice", "error": {"code": "QUOTA_EXCEEDED", "message": "budget used up"}});
        assert_eq!(
            pay_result(&uri, &reply(&wallet, &event, refused)),
            Err("The wallet refused: budget used up".into())
        );
    }

    #[test]
    fn ignores_replies_from_anyone_but_the_wallet() {
        let (wallet, uri) = connection();
        let uri = parse(&uri).unwrap();
        let request = pay_request(&uri, "lnbc10n1xyz").unwrap();
        let event: Event = serde_json::from_value(request["event"].clone()).unwrap();
        let paid = json!({"result_type": "pay_invoice", "result": {"preimage": "abc"}});
        assert!(pay_result(&uri, &reply(&Keys::generate(), &event, paid.clone())).is_err());
        assert!(pay_result(&uri, &reply(&wallet, &event, paid)).is_ok());
    }
}
