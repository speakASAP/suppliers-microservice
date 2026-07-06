export type BusinessHealthStatus = "pass" | "warn" | "blocked" | "fail";

export interface IntentPreservationChain {
  vision: string;
  goalImpact: string;
  system: string;
  feature: string;
  task: string;
  executionPlan: string;
  codingPrompt: string;
  code: string;
  validation: string;
}

export interface SupplierWarehouseTraceabilityEvidenceEnvelope {
  contractId: "suppliers.supplier_warehouse_traceability_business_health.v1";
  businessHealthContract: "stock-order-marketplace-business-health.v1";
  service: "suppliers-microservice";
  endpoint: "/api/business-health/supplier-warehouse-traceability";
  status: BusinessHealthStatus;
  generatedAt: string;
  evidenceKind: "supplier-to-warehouse-traceability";
  mutatesSuppliers: false;
  mutatesWarehouse: false;
  mutatesCatalog: false;
  mutatesMarketplace: false;
  runtimeDataQueried: false;
  productionDbQueried: false;
  liveSyntheticMutationAuthorized: false;
  sourceRefs: string[];
  assertions: string[];
  blockers: string[];
  forbiddenEvidence: string[];
  intentPreservation: IntentPreservationChain;
}
