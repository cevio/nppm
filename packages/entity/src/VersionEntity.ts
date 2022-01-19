import { Entity, PrimaryGeneratedColumn, Column, Index } from "typeorm";

@Entity({ name: 'npm_versions' })
@Index(['uid'])
@Index(['pid'])
@Index(['code'])
@Index(['gmt_create'])
@Index(['gmt_modified'])
export class VersionEntity {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({
    type: 'integer',
    default: 0,
    comment: '包上传者'
  })
  public uid: number;

  @Column({
    type: 'integer',
    comment: '包ID'
  })
  public pid: number;

  @Column({
    type: 'varchar',
    length: 40,
    comment: '版本号',
  })
  public code: string;

  @Column({
    type: 'text',
    comment: '描述',
  })
  public description: string;

  @Column({
    type: 'text',
    comment: '主页',
    nullable: true,
  })
  public homepage: string;

  @Column({
    type: 'varchar',
    length: 10,
    comment: '协议'
  })
  public license: string;

  @Column({
    type: 'text',
    comment: '文档'
  })
  public readme: string;

  @Column({
    type: 'json',
    comment: '仓库地址',
  })
  public repository: any;

  @Column({
    type: 'varchar',
    length: 40,
    comment: '加签码'
  })
  public shasum: string;

  @Column({
    type: 'text',
    comment: '文件路径'
  })
  public tarball: string;

  @Column({
    type: 'text',
    comment: '文件加密验证值'
  })
  public integrity: string;

  @Column({
    type: 'integer',
    default: 0,
    comment: '文件大小'
  })
  public attachment_size: number;

  @Column({
    type: 'varchar',
    default: 100,
    comment: '文件类型'
  })
  public attachment_type: string;

  @Column({
    type: 'varchar',
    length: 100,
    comment: '版本字符串ID'
  })
  public rev: string;

  @Column({
    type: 'text',
    comment: '废弃内容',
    nullable: true
  })
  public deprecated: string

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