import { Entity, PrimaryGeneratedColumn, Column, Index } from "typeorm";

@Entity({ name: 'npm_tags' })
@Index(['pid'])
@Index(['vid'])
@Index(['namespace'])
@Index(['gmt_create'])
@Index(['gmt_modified'])
export class TagEntity {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({
    type: 'integer',
    comment: '包ID'
  })
  public pid: number;

  @Column({
    type: 'varchar',
    length: 40,
    comment: '名称'
  })
  public namespace: string;

  @Column({
    type: 'integer',
    comment: '版本ID'
  })
  public vid: number;

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