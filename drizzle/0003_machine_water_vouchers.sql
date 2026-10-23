-- Preserve historical rows. Only newly issued vouchers require a machine.
ALTER TABLE redemptions ADD COLUMN machine_id TEXT;
--> statement-breakpoint
ALTER TABLE redemptions ADD COLUMN machine_name TEXT;
--> statement-breakpoint
ALTER TABLE redemptions ADD COLUMN machine_type TEXT;
--> statement-breakpoint
ALTER TABLE redemptions ADD COLUMN reward_label TEXT;
--> statement-breakpoint
ALTER TABLE redemptions ADD COLUMN redeemed_at TEXT;
--> statement-breakpoint
-- The original unique token index and wallet-accounting triggers stay intact.
CREATE TRIGGER water_voucher_binding_insert BEFORE INSERT ON redemptions
BEGIN
  SELECT CASE WHEN NEW.machine_id IS NULL OR length(NEW.machine_id)=0
    OR NEW.machine_name IS NULL OR length(NEW.machine_name)=0
    OR NEW.machine_type IS NULL OR NEW.machine_type NOT IN ('bottled-ambient','bottled-chilled','refill')
    OR NEW.reward_label IS NULL OR length(NEW.reward_label)=0
    OR NEW.redeemed_at IS NOT NULL
    OR length(NEW.token)<>32 OR NEW.token GLOB '*[^A-F0-9]*'
    THEN RAISE(ABORT,'INVALID_WATER_VOUCHER') END;
END;
--> statement-breakpoint
CREATE TRIGGER water_voucher_binding_immutable
BEFORE UPDATE OF id,user_id,cost,token,machine_id,machine_name,machine_type,reward_label,created_at ON redemptions
WHEN NEW.id IS NOT OLD.id OR NEW.user_id IS NOT OLD.user_id OR NEW.cost IS NOT OLD.cost
  OR NEW.token IS NOT OLD.token OR NEW.machine_id IS NOT OLD.machine_id
  OR NEW.machine_name IS NOT OLD.machine_name OR NEW.machine_type IS NOT OLD.machine_type
  OR NEW.reward_label IS NOT OLD.reward_label OR NEW.created_at IS NOT OLD.created_at
BEGIN
  SELECT RAISE(ABORT,'IMMUTABLE_WATER_VOUCHER');
END;
--> statement-breakpoint
CREATE TRIGGER water_voucher_transition BEFORE UPDATE OF status ON redemptions
WHEN NEW.status<>OLD.status
BEGIN
  SELECT CASE WHEN OLD.status<>'pending' OR NEW.status NOT IN ('confirmed','failed','expired')
    THEN RAISE(ABORT,'INVALID_VOUCHER_TRANSITION') END;
  SELECT CASE WHEN NEW.status='confirmed' AND
    (NEW.machine_id IS NULL OR NEW.redeemed_at IS NULL OR length(NEW.token)<>32
     OR NEW.expires_at<=NEW.redeemed_at OR NEW.expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    THEN RAISE(ABORT,'INVALID_VOUCHER_CONFIRMATION') END;
  SELECT CASE WHEN NEW.status<>'confirmed' AND NEW.redeemed_at IS NOT NULL
    THEN RAISE(ABORT,'INVALID_VOUCHER_CONFIRMATION') END;
END;
