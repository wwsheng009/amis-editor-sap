import React from 'react';
import {Provider} from 'mobx-react';
import {toast, alert, confirm} from 'amis';
import axios from 'axios';
import {MainStore} from './store/index';
import RootRoute from './route/index';
import copy from 'copy-to-clipboard';

export default function (): JSX.Element {
  const store = ((window as any).store = MainStore.create(
    {},
    {
      fetcher: ({url, method, data, config, headers}: any) => {
        if (url.toLowerCase().startsWith('/sap/opu/odata/sap/')) {
          url = url.replace(/@/g, '$');
        }
        config = config || {};
        config.headers = config.headers || headers || {};
        config.withCredentials = true;

        const catcherr = (error: any) => {
          if (
            error.response &&
            error.response.error &&
            error.response.error.message
          ) {
            error.message = error.response.error.message;
          }
          if (error.response) {
            console.log(error.response);
          } else if (error.request) {
            // The request was made but no response was received
            // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
            // http.ClientRequest in node.js
            console.log(error.request);
          } else {
            // Something happened in setting up the request that triggered an Error
            console.log('Error', error.message);
          }

          return new Promise(function (resolve, reject) {
            reject(error);
          });
        };
        const check = (response: any) => {
          if (
            typeof response.data === 'object' &&
            response.data !== null &&
            'data' in response.data &&
            'msg' in response.data &&
            'status' in response.data
          ) {
            return new Promise(function (resolve, reject) {
              resolve(response);
            });
          }
          const path = response.config.url;
          if (
            !path.startsWith('/api') &&
            !path.startsWith('/sap') &&
            !path.startsWith('/amis')
          ) {
            return new Promise(function (resolve, reject) {
              resolve(response);
            });
          }
          let payload = response.data;
          if (response.headers['dataserviceversion'] == '2.0') {
            // odata 2.0
            if (
              response.data != null &&
              typeof response.data === 'number' &&
              url.includes('$count')
            ) {
              // odata data count adapter
              payload = {
                status: 0,
                msg: 'ok',
                data: {count: response.data}
              };
            }
            // data array adapter
            if (response.data && response.data.d && response.data.d.results) {
              payload = {
                status: 0,
                msg: 'ok',
                data: {
                  items: response.data.d.results,
                  total: response.data.d.results.length
                }
              };
            }
          } else {
            payload = {
              status: !response.data.code ? 0 : response.data.code,
              msg: response.data.message ? response.data.message : '',
              data: response.data
            };
          }
          response.data = payload;
          // 在这个回调函数中返回一个新的 Promise 对象
          return new Promise(function (resolve, reject) {
            // 这里应该返回一个新的response,可以在下一个adapter里使用
            // 执行异步操作
            // 在异步操作完成后调用 resolve 或 reject
            resolve(response);
          });
        };

        if (method !== 'post' && method !== 'put' && method !== 'patch') {
          if (data) {
            config.params = data;
          }
          return (axios as any)
            [method](url, config)
            .then(check)
            .catch(catcherr);
        } else if (data && data instanceof FormData) {
          // config.headers = config.headers || {};
          // config.headers['Content-Type'] = 'multipart/form-data';
        } else if (
          data &&
          typeof data !== 'string' &&
          !(data instanceof Blob) &&
          !(data instanceof ArrayBuffer)
        ) {
          data = JSON.stringify(data);
          config.headers['Content-Type'] = 'application/json';
        }

        return (axios as any)
          [method](url, data, config)
          .then(check)
          .catch(catcherr);
      },
      isCancel: (e: any) => axios.isCancel(e),
      notify: (type: 'success' | 'error' | 'info', msg: string) => {
        toast[type]
          ? toast[type](msg, type === 'error' ? '系统错误' : '系统消息')
          : console.warn('[Notify]', type, msg);
        console.log('[notify]', type, msg);
      },
      alert,
      confirm,
      copy: (contents: string, options: any = {}) => {
        const ret = copy(contents, options);
        ret &&
          (!options || options.shutup !== true) &&
          toast.info('内容已拷贝到剪切板');
        return ret;
      }
    }
  ));

  return (
    <Provider store={store}>
      <RootRoute store={store} />
    </Provider>
  );
}
