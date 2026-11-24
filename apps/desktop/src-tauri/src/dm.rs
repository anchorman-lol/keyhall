use nostr::nips::nip59::{GiftWrapBuilder, UnwrappedGift};
use nostr::prelude::{
    Event, EventBuilder, FinalizeEvent, FinalizeUnsignedEvent, Keys, Kind, PublicKey, Tag,
};
use serde::Serialize;

#[derive(Serialize, Debug, PartialEq)]
pub struct Message {
    pub id: String,
    pub from: String,
    pub to: String,
    pub text: String,
    pub at: u64,
}

/// NIP-17: one gift wrap for the recipient and one for the sender's own inbox.
pub fn wrap(keys: &Keys, to: PublicKey, text: &str) -> Result<[Event; 2], String> {
    let rumor = EventBuilder::new(Kind::PrivateDirectMessage, text)
        .tag(Tag::public_key(to))
        .finalize_unsigned(keys.public_key());
    let gift = |receiver| {
        GiftWrapBuilder::new(receiver, rumor.clone())
            .finalize(keys)
            .map_err(|e| e.to_string())
    };
    Ok([gift(to)?, gift(keys.public_key())?])
}

fn open(keys: &Keys, wrap: &Event) -> Result<UnwrappedGift, String> {
    UnwrappedGift::from_gift_wrap(keys, wrap).map_err(|e| e.to_string())
}

pub fn unwrap(keys: &Keys, wrap: &Event) -> Result<Message, String> {
    let UnwrappedGift { sender, mut rumor } = open(keys, wrap)?;
    let to: Vec<_> = rumor.tags.public_keys().collect();
    match (rumor.kind, to.as_slice()) {
        (Kind::PrivateDirectMessage, [to]) => Ok(Message {
            id: rumor.id().to_hex(),
            from: sender.to_hex(),
            to: to.to_hex(),
            text: rumor.content,
            at: rumor.created_at.as_secs(),
        }),
        _ => Err("Not a direct message".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wraps_a_message_that_both_sides_can_read() {
        let (me, friend) = (Keys::generate(), Keys::generate());
        let [theirs, mine] = wrap(&me, friend.public_key(), "gg").unwrap();
        for event in [&theirs, &mine] {
            assert_eq!(event.kind, Kind::GiftWrap);
            assert_ne!(event.pubkey, me.public_key());
        }
        let received = unwrap(&friend, &theirs).unwrap();
        assert_eq!(received.from, me.public_key().to_hex());
        assert_eq!(received.to, friend.public_key().to_hex());
        assert_eq!(received.text, "gg");
        assert_eq!(unwrap(&me, &mine), Ok(received));
        assert!(unwrap(&Keys::generate(), &theirs).is_err());
        assert!(unwrap(&me, &theirs).is_err());
    }

    const SENDER: &str = "611df01bfcf85c26ae65453b772d8f1dfd25c264621c0277e1fc1518686faef9";

    fn recipient() -> Keys {
        Keys::parse("e108399bd8424357a710b606ae0c13166d853d327e47a6e5e038197346bdbf45").unwrap()
    }

    /// The example from NIP-59, which wraps a kind 1 rumor rather than a DM.
    #[test]
    fn opens_the_nip59_example() {
        let wrap: Event = serde_json::from_str(include_str!("nip59-example.json")).unwrap();
        let gift = open(&recipient(), &wrap).unwrap();
        assert_eq!(gift.sender.to_hex(), SENDER);
        assert_eq!(gift.rumor.content, "Are you going to the party tonight?");
        assert!(unwrap(&recipient(), &wrap).is_err());
    }

    /// A DM wrapped by nostr-tools' `nip17.wrapEvent`, between the NIP-59 example keys.
    #[test]
    fn reads_a_dm_from_nostr_tools() {
        let wrap: Event = serde_json::from_str(include_str!("nostr-tools-dm.json")).unwrap();
        let message = unwrap(&recipient(), &wrap).unwrap();
        assert_eq!(message.from, SENDER);
        assert_eq!(message.to, recipient().public_key().to_hex());
        assert_eq!(message.text, "Hola, que tal?");
    }
}
