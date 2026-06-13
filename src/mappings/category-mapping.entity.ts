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

  // Catalog owns category identity; Suppliers only stores the selected Catalog category ID.
  @Column({ nullable: true })
  catalogCategoryId: string;

  @CreateDateColumn()
  createdAt: Date;
}
