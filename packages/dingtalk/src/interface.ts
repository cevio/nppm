export interface TUserInfo extends TCommonResult {
  "unionid": string,
  "remark": string,
  "userid": string,
  "isLeaderInDepts": string,
  "isBoss": boolean,
  "hiredDate": number,
  "isSenior": boolean,
  "tel": string,
  "department": number[],
  "workPlace": string,
  "email": string,
  "orderInDepts": string,
  "mobile": string,
  "active": boolean,
  "avatar": string,
  "isAdmin": boolean,
  "isHide": boolean,
  "jobnumber": string,
  "name": string,
  "extattr": any,
  "stateCode": string,
  "position": string,
  "roles": {
    "id": number,
    "name": string,
    "groupName": string
  }[]
}

export interface TCommonResult {
  errcode: number,
  errmsg: string,
}

export interface TOpenID extends TCommonResult {
  user_info: {
    nick: string,
    openid: string,
    unionid: string,
    dingId?: string,
    main_org_auth_high_level?: boolean,
  }
}

export interface TAccessToken extends TCommonResult {
  access_token: string,
  expires_in: number
}

export interface TUserID extends TCommonResult {
  contactType: number,
  userid: string,
}