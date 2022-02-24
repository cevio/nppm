export interface TAccessToken {
  "errcode": number,
  "errmsg": string,
  "access_token": string,
  "expires_in": 7200,
}

export interface TOpenID {
  "errcode": number,
  "errmsg": string,
  "UserId": string,
}

export interface TUser {
	"errcode": number,
	"errmsg": string,
	"userid": string,
	"name": string,
	"department": number[],
	"order": number[],
	"position": string,
	"mobile": string,
	"gender": string,
	"email": string,
	"biz_mail": string,
	"is_leader_in_dept": number[],
	"direct_leader": string[],
	"avatar": string,
	"thumb_avatar": string,
	"telephone": string,
	"alias": string,
	"address": string,
	"open_userid": string,
	"main_department": number,
	"status": number,
	"qr_code": string,
	"external_position": string,
	"external_profile": {
		"external_corp_name": string,
		"wechat_channels": {
			"nickname": string,
			"status": number
		}
	}
}