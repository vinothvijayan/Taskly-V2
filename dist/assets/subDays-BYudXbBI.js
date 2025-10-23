import{c,b2 as o}from"./index-C20fHVmm.js";import{c as f}from"./format-CcypP5ZI.js";/**
 * @license lucide-react v0.539.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]],l=c("chevron-left",u);function i(n,t){const e=o(n);return isNaN(t)?f(n,NaN):(t&&e.setDate(e.getDate()+t),e)}function g(n,t){const e=o(n),r=o(t),s=e.getFullYear()-r.getFullYear(),a=e.getMonth()-r.getMonth();return s*12+a}function D(n){const t=o(n),e=t.getMonth();return t.setFullYear(t.getFullYear(),e+1,0),t.setHours(23,59,59,999),t}function m(n,t){return i(n,-t)}export{l as C,i as a,g as d,D as e,m as s};
