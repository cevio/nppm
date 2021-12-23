import { Service, Public } from '@nppm/radox';
import { Worker } from '@nppm/process';

@Service('com.nppm.test.service')
export class TestService {
  get radox() {
    return Worker.radox.value;
  }

  @Public()
  public authorize(session: string) {
    return {
      url: 'http://baidu.com?session=' + session,
    }
    // return {
    //   html: `<div>
    //     <p>session = ${session}</p>
    //   </div>`
    // }
  }

  @Public()
  public check(session: string) {
    // return { 
    //   account: 'evio', 
    //   avatar: 'https://avatar', 
    //   email: 'evio@vip.qq.com', 
    //   token: string, nickname?: string }
  }
}