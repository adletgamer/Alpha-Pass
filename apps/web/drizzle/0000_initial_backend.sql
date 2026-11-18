CREATE TABLE "audit_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"lot_id" text,
	"actor_wallet" varchar(56),
	"action" varchar(64) NOT NULL,
	"tx_hash" varchar(64),
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" text NOT NULL,
	"vc_id" text NOT NULL,
	"issuer_did" text NOT NULL,
	"subject" text NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escrows" (
	"lot_id" text PRIMARY KEY NOT NULL,
	"contract_id" varchar(56) NOT NULL,
	"buyer_wallet" varchar(56) NOT NULL,
	"receiver_wallet" varchar(56) NOT NULL,
	"asset_code" varchar(12) NOT NULL,
	"asset_issuer" varchar(56) NOT NULL,
	"amount" numeric(24, 7) NOT NULL,
	"state" varchar(24) DEFAULT 'deployed' NOT NULL,
	"funded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "escrows_contract_id_unique" UNIQUE("contract_id")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(32) NOT NULL,
	"lot_id" text,
	"state" varchar(24) DEFAULT 'pending' NOT NULL,
	"payload" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lots" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"cooperative_wallet" varchar(56) NOT NULL,
	"buyer_wallet" varchar(56),
	"product" text NOT NULL,
	"passport_root" varchar(64),
	"passport_tx_hash" varchar(64),
	"state" varchar(32) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"lot_id" text NOT NULL,
	"name" varchar(16) NOT NULL,
	"issuer_wallet" varchar(56),
	"evidence_hash" varchar(64),
	"attestation_tx_hash" varchar(64),
	"approval_tx_hash" varchar(64),
	"release_tx_hash" varchar(64),
	"amount" numeric(24, 7),
	"state" varchar(24) DEFAULT 'pending' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "milestones_lot_id_name_pk" PRIMARY KEY("lot_id","name")
);
--> statement-breakpoint
CREATE TABLE "organization_wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"address" varchar(56) NOT NULL,
	"role" varchar(24) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parcels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" text NOT NULL,
	"external_id" text NOT NULL,
	"producer_name" text,
	"bags" integer NOT NULL,
	"geometry" jsonb NOT NULL,
	"risk" varchar(24) DEFAULT 'pendiente' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" varchar(56) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "wallet_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" varchar(56) NOT NULL,
	"nonce_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_challenges_nonce_hash_unique" UNIQUE("nonce_hash")
);
--> statement-breakpoint
CREATE TABLE "whisp_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" text NOT NULL,
	"provider_token" text,
	"state" varchar(24) DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"whisp_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrows" ADD CONSTRAINT "escrows_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_wallets" ADD CONSTRAINT "organization_wallets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whisp_jobs" ADD CONSTRAINT "whisp_jobs_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_lot_idx" ON "audit_events" USING btree ("lot_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "credential_vc_unique" ON "credentials" USING btree ("vc_id");--> statement-breakpoint
CREATE INDEX "jobs_due_idx" ON "jobs" USING btree ("state","run_after");--> statement-breakpoint
CREATE INDEX "lots_organization_idx" ON "lots" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_wallet_role_unique" ON "organization_wallets" USING btree ("organization_id","address","role");--> statement-breakpoint
CREATE INDEX "organization_wallet_address_idx" ON "organization_wallets" USING btree ("address");--> statement-breakpoint
CREATE UNIQUE INDEX "parcel_lot_external_unique" ON "parcels" USING btree ("lot_id","external_id");--> statement-breakpoint
CREATE INDEX "sessions_address_idx" ON "sessions" USING btree ("address");--> statement-breakpoint
CREATE INDEX "whisp_jobs_lot_idx" ON "whisp_jobs" USING btree ("lot_id");