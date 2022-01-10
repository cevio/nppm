import { Entity, PrimaryGeneratedColumn, Column, Index } from "typeorm";

@Entity({ name: 'npm_maintainers' })
@Index(['pid'])
@Index(['uid'])
@Index(['gmt_create'])
@Index(['gmt_modified'])
export class MaintainerEntity {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({
    type: 'integer',
    comment: '包ID'
  })
  public pid: number;

  @Column({
    type: 'integer',
    comment: '用户ID'
  })
  public uid: number;

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