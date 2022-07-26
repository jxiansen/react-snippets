/* 
自定义实现 React-router 不使用其他库
使用方法:
在react组件的最顶层:
- 导入Router (e.g.: import Router from './Router')
- 创建一个数组对象来关联 path 和对应的组件
- 创建404组件,用来作为没有匹配到的情况
- 返回一个 Router 组件作为最顶层的 Router 组件
Example:
```
function App() {
   const routes = [{path:"/", component:<Home/>}, {path:"/register", component:<Register/>}]
   const defaultComponent = <NoPageExists/>
   
   return (
      <Router routes={routes} defaultComponent={defaultComponent}/>
   )
}
```

接下来是使用 routes:
- 使用 <a href> 就像你平时使用的那样,比如. <a href="/register">Register</a>
- 如果你想要添加一个点击事件处理器给按钮或者其他,使用 `navigate` function,例如:
  <Button onClick={(e) => navigate("/register")} fullWidth>Register</Button>
*/

import React from "react";
import { useEffect, useState } from "react";

// 全局监听点击事件
// Credit Chris Morgan: https://news.ycombinator.com/item?id=31373486
window.addEventListener("click", function (event) {
  // 只有点击事件中是由<a></a>标签触发的才进行
  const link = event.target.closest("a");
  // 正确的处理对外部网站的点击和修改判断点击事件中是否包含其他键盘按键
  if (
    !event.button &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    link &&
    link.href.startsWith(window.location.origin + "/") &&
    link.target !== "_blank"
  ) {
    // 阻止页面重新刷新加载
    event.preventDefault();
    // 主路由方法
    navigate(link.href);
  }
});

/* 主要组件 */

export default function Router({ routes, defaultComponent }) {
  // 监听 url 的状态变化,并强制组件在变化的时候重新渲染
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    // 将回调定义为单独的函数,方便以后可以用清理函数将器删除
    const onLocationChange = () => {
      // 更新当前 window 中 URL
      setCurrentPath(window.location.pathname);
    };

    // 监听 popstate 事件
    window.addEventListener("popstate", onLocationChange);

    // 移除事件监听器
    return () => {
      window.removeEventListener("popstate", onLocationChange);
    };
  }, []);
  return (
    routes.find(({ path, component }) => path === currentPath)?.component ||
    defaultComponent
  );
}

/* 使用下面的 navigate 函数来导航到指定页面 */

export function navigate(href) {
  // 更新 url
  window.history.pushState({}, "", href);

  // 向 Routes 通知, URL 已经改变
  const navEvent = new PopStateEvent("popstate");
  window.dispatchEvent(navEvent);
}
