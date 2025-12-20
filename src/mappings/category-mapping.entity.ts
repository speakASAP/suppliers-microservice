import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm';

@Entity('category_mappings')
@Unique(['supplierId', 'supplierCategoryId'])
export class CategoryMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  supplierId: string;

  @Column({ length: 200 })
  supplierCategoryId: string;

  @Column({ length: 500, nullable: true })
  supplierCategoryName: string;

  // Target category ID in catalog-microservice
  @Column({ nullable: true })
  catalogCategoryId: string;

  @CreateDateColumn()
  createdAt: Date;
}

