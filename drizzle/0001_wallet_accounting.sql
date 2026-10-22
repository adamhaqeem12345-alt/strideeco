-- Custom SQL migration file, put your code below! --
CREATE TRIGGER activity_credit AFTER INSERT ON activities
BEGIN
  UPDATE wallets SET points=points+NEW.points WHERE user_id=NEW.user_id;
  INSERT INTO point_events(id,user_id,delta,kind,reference,created_at)
  VALUES('activity:'||NEW.id,NEW.user_id,NEW.points,CASE WHEN NEW.source='demo' THEN 'demo_credit' ELSE 'activity_credit' END,'activity:'||NEW.id,NEW.created_at);
END;
--> statement-breakpoint
CREATE TRIGGER water_reservation_check BEFORE INSERT ON redemptions
BEGIN
  SELECT CASE WHEN NEW.status<>'pending' OR NEW.cost<=0 THEN RAISE(ABORT,'INVALID_REDEMPTION') END;
  SELECT CASE WHEN COALESCE((SELECT points-reserved FROM wallets WHERE user_id=NEW.user_id),0)<NEW.cost THEN RAISE(ABORT,'INSUFFICIENT_POINTS') END;
  SELECT CASE WHEN (SELECT COUNT(*) FROM redemptions WHERE user_id=NEW.user_id AND status IN ('pending','confirmed') AND substr(created_at,1,7)=substr(NEW.created_at,1,7))>=4 THEN RAISE(ABORT,'MONTHLY_LIMIT') END;
END;
--> statement-breakpoint
CREATE TRIGGER water_reserve AFTER INSERT ON redemptions
BEGIN
  UPDATE wallets SET reserved=reserved+NEW.cost WHERE user_id=NEW.user_id;
END;
--> statement-breakpoint
CREATE TRIGGER water_confirm AFTER UPDATE OF status ON redemptions
WHEN OLD.status='pending' AND NEW.status='confirmed'
BEGIN
  UPDATE wallets SET points=points-NEW.cost,reserved=reserved-NEW.cost WHERE user_id=NEW.user_id;
  INSERT INTO point_events(id,user_id,delta,kind,reference,created_at)
  VALUES('water:'||NEW.id,NEW.user_id,-NEW.cost,'water_redemption','water:'||NEW.id,NEW.created_at);
END;
--> statement-breakpoint
CREATE TRIGGER water_release AFTER UPDATE OF status ON redemptions
WHEN OLD.status='pending' AND NEW.status IN ('failed','expired')
BEGIN
  UPDATE wallets SET reserved=reserved-NEW.cost WHERE user_id=NEW.user_id;
END;
