import {
  bigint, index, integer, jsonb, numeric, pgTable, primaryKey, text,
  timestamp, uniqueIndex, uuid, varchar,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const wallet = (name: string) => varchar(name, { length: 56 }).notNull();

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export const organizationWallets = pgTable("organization_wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  address: wallet("address"),
  role: varchar("role", { length: 24 }).notNull(),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("organization_wallet_role_unique").on(table.organizationId, table.address, table.role),
  index("organization_wallet_address_idx").on(table.address),
]);

export const lots = pgTable("lots", {
  id: text("id").primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  cooperativeWallet: wallet("cooperative_wallet"),
  buyerWallet: varchar("buyer_wallet", { length: 56 }),
  product: text("product").notNull(),
  passportRoot: varchar("passport_root", { length: 64 }),
  passportTxHash: varchar("passport_tx_hash", { length: 64 }),
  state: varchar("state", { length: 32 }).notNull().default("draft"),
  createdAt: createdAt(),
}, (table) => [index("lots_organization_idx").on(table.organizationId)]);

export const parcels = pgTable("parcels", {
  id: uuid("id").primaryKey().defaultRandom(),
  lotId: text("lot_id").notNull().references(() => lots.id),
  externalId: text("external_id").notNull(),
  producerName: text("producer_name"),
  bags: integer("bags").notNull(),
  geometry: jsonb("geometry").notNull(),
  risk: varchar("risk", { length: 24 }).notNull().default("pendiente"),
  createdAt: createdAt(),
}, (table) => [uniqueIndex("parcel_lot_external_unique").on(table.lotId, table.externalId)]);

export const whispJobs = pgTable("whisp_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  lotId: text("lot_id").notNull().references(() => lots.id),
  providerToken: text("provider_token"),
  state: varchar("state", { length: 24 }).notNull().default("pending"),
  result: jsonb("result"),
  whispVersion: text("whisp_version"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("whisp_jobs_lot_idx").on(table.lotId)]);

export const credentials = pgTable("credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  lotId: text("lot_id").notNull().references(() => lots.id),
  vcId: text("vc_id").notNull(),
  issuerDid: text("issuer_did").notNull(),
  subject: text("subject").notNull(),
  contentHash: varchar("content_hash", { length: 64 }).notNull(),
  status: varchar("status", { length: 24 }).notNull().default("active"),
  createdAt: createdAt(),
}, (table) => [uniqueIndex("credential_vc_unique").on(table.vcId)]);

export const escrows = pgTable("escrows", {
  lotId: text("lot_id").primaryKey().references(() => lots.id),
  contractId: varchar("contract_id", { length: 56 }).notNull().unique(),
  buyerWallet: wallet("buyer_wallet"),
  receiverWallet: wallet("receiver_wallet"),
  assetCode: varchar("asset_code", { length: 12 }).notNull(),
  assetIssuer: wallet("asset_issuer"),
  amount: numeric("amount", { precision: 24, scale: 7 }).notNull(),
  state: varchar("state", { length: 24 }).notNull().default("deployed"),
  fundedAt: timestamp("funded_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const milestones = pgTable("milestones", {
  lotId: text("lot_id").notNull().references(() => lots.id),
  name: varchar("name", { length: 16 }).notNull(),
  issuerWallet: varchar("issuer_wallet", { length: 56 }),
  evidenceHash: varchar("evidence_hash", { length: 64 }),
  attestationTxHash: varchar("attestation_tx_hash", { length: 64 }),
  approvalTxHash: varchar("approval_tx_hash", { length: 64 }),
  releaseTxHash: varchar("release_tx_hash", { length: 64 }),
  amount: numeric("amount", { precision: 24, scale: 7 }),
  state: varchar("state", { length: 24 }).notNull().default("pending"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.lotId, table.name] })]);

export const walletChallenges = pgTable("wallet_challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  address: wallet("address"),
  nonceHash: varchar("nonce_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  address: wallet("address"),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
}, (table) => [index("sessions_address_idx").on(table.address)]);

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: varchar("kind", { length: 32 }).notNull(),
  lotId: text("lot_id").references(() => lots.id),
  state: varchar("state", { length: 24 }).notNull().default("pending"),
  payload: jsonb("payload").notNull(),
  attempts: integer("attempts").notNull().default(0),
  runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
  createdAt: createdAt(),
}, (table) => [index("jobs_due_idx").on(table.state, table.runAfter)]);

export const auditEvents = pgTable("audit_events", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  lotId: text("lot_id").references(() => lots.id),
  actorWallet: varchar("actor_wallet", { length: 56 }),
  action: varchar("action", { length: 64 }).notNull(),
  txHash: varchar("tx_hash", { length: 64 }),
  details: jsonb("details"),
  createdAt: createdAt(),
}, (table) => [index("audit_lot_idx").on(table.lotId, table.createdAt)]);
