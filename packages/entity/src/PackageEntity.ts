import { Entity, PrimaryGeneratedColumn, Column, Index } from "typeorm";

@Entity({ name: 'npm_packages' })
@Index(['pathname'], { unique: true })
@Index(['scope'])
@Index(['versions'])
@Index(['maintainers'])
@Index(['gmt_create'])
@Index(['gmt_modified'])
@Index(['uid'])
export class PackageEntity {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({
    type: 'varchar',
    length: 50,
    comment: '包组名'
  })
  public scope: string;

  @Column({
    type: 'varchar',
    length: 50,
    comment: '包名'
  })
  public name: string;

  @Column({
    type: 'varchar',
    length: 101,
    comment: '包'
  })
  public pathname: string;

  @Column({
    type: 'integer',
    comment: '该包的管理员'
  })
  public uid: number;

  @Column({
    type: 'integer',
    default: 0,
    comment: '包的版本数',
  })
  public versions: number;

  @Column({
    type: 'integer',
    default: 0,
    comment: '包的维护者数量'
  })
  public maintainers: number;

  @Column({
    type: 'bool',
    default: true,
    comment: '是否私有包'
  })
  public is_private: boolean;

  @Column({
    type: 'varchar',
    length: 32,
    comment: '对外唯一字符串'
  })
  public rev: string;

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