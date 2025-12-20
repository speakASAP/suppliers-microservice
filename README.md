# Supplier Microservice

Connects to supplier APIs to import products and stock into the central catalog.

## Port: 3202 (supplier.statex.cz)

## API Endpoints

- `GET /api/suppliers` - List suppliers
- `GET /api/suppliers/:id` - Get supplier
- `POST /api/suppliers` - Create supplier
- `PUT /api/suppliers/:id` - Update supplier
- `GET /api/imports` - List import jobs
- `POST /api/imports/run/:supplierId` - Run import for supplier
- `GET /api/mappings/supplier/:supplierId` - Get category mappings
- `POST /api/mappings` - Set category mapping
- `GET /health` - Health check

## Features

- Connect to supplier REST/XML/CSV APIs
- Scheduled automatic imports
- Category mapping (supplier → catalog)
- Import job tracking

## Related Services

- `catalog-microservice` (3200) - Target for imported products
- `warehouse-microservice` (3201) - Target for imported stock

