import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity({ name: 'npm_configs' })
export class ConfigEntity {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({
    type: 'varchar',
    length: 255,
    comment: '本站域名，用户包对外输出的域名'
  })
  public domain: string;

  @Column({
    type: 'json',
    comment: '允许入库的包前缀',
  })
  public scopes: string[];

  @Column({
    type: 'varchar',
    length: 255,
    comment: '登录类型，即登录插件码',
    default: 'default',
  })
  public login_code: string;

  @Column({
    type: 'json',
    comment: '支持的registry列表',
  })
  public registries: string[];

  @Column({
    type: 'varchar',
    length: 255,
    comment: 'TGZ包存放的文件夹名',
    default: 'packages',
    nullable: true,
  })
  public dictionary: string;

  @Column({
    type: 'bool',
    comment: '是否开放注册',
    default: false
  })
  public registerable: boolean;
}