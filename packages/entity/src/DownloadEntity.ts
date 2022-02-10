import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity({ name: 'npm_downloads' })
export class DowloadEntity {
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
    type: 'timestamp',
    comment: '创建时间'
  })
  public gmt_create: Date;
}