import { Entity, PrimaryGeneratedColumn, Column, Index } from "typeorm";

@Entity({ name: 'npm_dependencies' })
@Index(['vid'])
@Index(['pid'])
@Index(['pathname'])
@Index(['gmt_create'])
@Index(['gmt_modified'])
export class DependencyEntity {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({
    type: 'integer',
    comment: '版本ID'
  })
  public vid: number;

  @Column({
    type: 'integer',
    comment: '包ID'
  })
  public pid: number;

  @Column({
    type: 'varchar',
    length: 101,
    comment: '包路径'
  })
  public pathname: string;

  @Column({
    type: 'varchar',
    length: 100,
    comment: '包版本'
  })
  public value: string;

  @Column({
    type: 'timestamp',
    comment: '创建时间'
  })
  public gmt_create: Date;

  @Column({
    type: 'timestamp',
    comment: '更新时间'
  })
  public gmt_modified: Date;
}