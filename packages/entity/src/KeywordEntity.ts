import { Entity, PrimaryGeneratedColumn, Column, Index } from "typeorm";

@Entity({ name: 'npm_keywords' })
@Index(['vid'])
@Index(['gmt_create'])
@Index(['gmt_modified'])
export class KeywordEntity {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({
    type: 'integer',
    comment: '版本ID'
  })
  public vid: number;

  @Column({
    type: 'varchar',
    length: 40,
    comment: '关键字'
  })
  public name: string;

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