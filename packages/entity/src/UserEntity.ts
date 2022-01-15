import { Entity, PrimaryGeneratedColumn, Column, Index } from "typeorm";

@Entity({ name: 'npm_users' })
@Index(['account'])
@Index(['gmt_create'])
@Index(['gmt_modified'])
export class UserEntity {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({
    type: 'varchar',
    length: 255,
    comment: '用户登入账号，在同一种登录类型下必须唯一',
    nullable: false
  })
  public account: string;

  @Column({
    type: 'varchar',
    length: 255,
    comment: '昵称',
    nullable: true,
  })
  public nickname: string;

  @Column({
    type: 'varchar',
    length: 255,
    comment: '邮箱',
    nullable: false,
  })
  public email: string;

  @Column({
    type: 'varchar',
    length: 255,
    comment: '来源类型，即登录插件码',
    default: 'default',
    nullable: true,
  })
  public login_code: string;

  @Column({
    type: 'text',
    comment: '头像',
    nullable: true,
  })
  public avatar: string;

  @Column({
    type: 'varchar',
    length: 5,
    comment: '加盐',
    nullable: true,
  })
  public salt: string;

  @Column({
    type: 'varchar',
    length: 40,
    comment: '密码编码',
    nullable: true,
  })
  public password: string;

  @Column({
    type: 'bool',
    default: false,
    comment: '是否禁止登录'
  })
  public login_forbiden: boolean;

  @Column({
    type: 'json',
    comment: '允许入库的包前缀',
    nullable: true,
  })
  public scopes: string[];

  @Column({
    type: 'bool',
    comment: '是否为管理员',
    default: false
  })
  public admin: boolean;

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