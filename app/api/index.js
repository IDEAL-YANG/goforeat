import axios from 'axios'
import md5 from 'js-md5'

const root_url = 'http://goforeat.hk'
const test_url = 'http://localhost:1091'

const api = {
  getCanteenDetail(page) {
    const params = {
      page: page,
      condition: 'default',
      limit: 12
    }
    return axios.get(root_url + '/guide/queryCanteen',{
      params:params,
      timeout: 4500
    })
  },
  getCanteenOptions() {
    return axios.get(root_url + '/guide/getCanteenOption')
  },
  testLogin(username,password) {
    let params = new URLSearchParams();
    params.append('username',username);
    params.append('password',md5(password));
        return axios.post(
          test_url + "/api/user/login_v2",
            params, {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }
        );
  }
}

module.exports = api
