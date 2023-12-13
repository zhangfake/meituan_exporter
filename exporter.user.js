
// ==UserScript==
// @name        exportor
// @namespace   zhangfake meituan_exporter
// @match       *://*.meituan.com/
// @grant       GM_xmlhttpRequest
// @grant       GM_setValue
// @grant       GM_getValue
// @version     1.1
// @author      -
// @description 2023/6/19 18:18:00ulit
// @run-at      document-idle
// @require     https://www.layuicdn.com/layui-v2.8.7/layui.js
// @downloadURL https://raw.githubusercontent.com/zhangfake/meituan_exporter/main/exportor.js
// ==/UserScript==

let url = location.href
const isWaimai = location.href.indexOf('waimaie') > 0
if (url.match(/\/\/(shangoue|waimaie)\.meituan\.com\//)) {
  const styleSheet = document.createElement('link');
  styleSheet.setAttribute("href", "https://www.layuicdn.com/layui-v2.8.7/css/layui.css")
  styleSheet.setAttribute("rel", "stylesheet")
  document.body.appendChild(styleSheet)

  const innerStyle = document.createElement("style");
  innerStyle.innerHTML = `
.plugin-menu-button {
  position: fixed;
  left: 0;
  top: 0;
  cursor: pointer;
  z-index: 99999
}
textarea {
  resize: none
}
`
  document.body.appendChild(innerStyle)


  const formatDateTime = (timestamp) => {
    const date = new Date(timestamp);
    return [date.getFullYear(), (date.getMonth() + 1).toString().padStart(2, '0'), date.getDate().toString().padStart(2, '0')].join('-')
      + ' ' + [date.getHours().toString().padStart(2, '0'), date.getMinutes().toString().padStart(2, '0'), date.getSeconds().toString().padStart(2, '0')].join(':')
  }


  layui.use(function () {
    const layer = layui.layer;
    const laydate = layui.laydate;
    const form = layui.form;
    const points = JSON.parse(localStorage.localAllPoiList)
    let config = JSON.parse(GM_getValue('config', '{"start_time":"", "store_id": "", "max_page": "", "state": 0, "num_per_file": 1500}'))
    const storeOptions = points.map(item => {
      const selected = item.id == config.store_id ? 'selected' : ''
      return `<option value="${item.id}" ${selected}>${item.poiName}</option>`
    })
    const startDownloadThread = async field => {
      layer.msg("正在导出,请勿关闭页面")
      layer.open({ type: 3 })
      // 存储当前数据
      config = field
      field.start_time = formatDateTime(Date.now())
      GM_setValue("config", JSON.stringify(field))

      let totalItem = 1, page = 1, pageSize = isWaimai ? 30 : 100, maxPage = config.max_page || 0;
      let products = []
      do {
        let pageData = isWaimai ? await fetch("https://waimaie.meituan.com/gw/bizproduct/v3/food/r/spuListV2?region_id=1000520300&region_version=1691377749", {
          "headers": {
            "content-type": "application/x-www-form-urlencoded",
          },
          "body": `opType=${config.state}&queryCount=${config.state}&pageNum=${page}&pageSize=${pageSize}&wmPoiId=${config.store_id}&needAllCount=false&needTagList=true&scenario=0`,
          "method": "POST",
        }).then(e => e.json()) : await fetch("https://shangoue.meituan.com/reuse/sc/product/retail/r/searchListPage", {
          "headers": {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          "body": `wmPoiId=${config.store_id}&pageNum=${page}&pageSize=${pageSize}&needTag=0&name=&brandId=0&tagId=0&searchWord=&state=${config.state}&saleStatus=0&limitSale=0&needCombinationSpu=2&noStockAutoClear=-1`,
          "method": "POST",
        }).then(e => e.json())
        totalItem = maxPage ? maxPage * pageSize : pageData.data.totalCount
        for (let i = 0; i < pageData.data.productList.length; i++) {
          layer.msg("正在读取 " + (products.length + i) + "/" + totalItem)
          const product = pageData.data.productList[i]
          try {
            const itemData = isWaimai ? await fetch(`https://waimaie.meituan.com/reuse/product/properties/r/template?spuId=${product.id}&wmPoiId=${config.store_id}&isNew=1`).then(e => e.json()) : await fetch(`https://shangoue.meituan.com/reuse/sc/product/shangou/r/detailProductAndMedicine?spuId=${product.id}&wmPoiId=${config.store_id}&yodaReady=h5&csecplatform=4&csecversion=2.3.1`, {
              "referrer": `https://shangoue.meituan.com/reuse/sc/product/views/product/edit?spuId=${product.id}&wmPoiId=${config.store_id}&from=single`,
              "method": "GET",
            }).then(e => e.json())
            if (isWaimai) {
              pageData.data.productList[i].category = itemData.data.category
              pageData.data.productList[i].properties_values = itemData.data.properties_values
              
            } else {
              pageData.data.productList[i] = itemData.data
            }
          } catch (e) {

          }
        }
        products = products.concat(pageData.data.productList)
        if (products.length > config.num_per_file) {
          exportToCsv('data.csv', products.splice(0, config.num_per_file))
        }
        page++
        if (maxPage > 0 && page > maxPage) {
          break;
        }
        if (page > Math.ceil(totalItem / pageSize)) {
          break;
        }
      } while (true)
      if (!products.length) {
        layer.msg('没有数据可以导出', { icon: 1 });
        return;
      }
      exportToCsv('data.csv', products)
      layer.closeAll('loading')
    }
    function exportToCsv(filename, rows) {
      rows = [["美团ID", "美团名称", "美团类目", "美团商品原始数据"]].concat(rows.map(item => {
        return [
          item.id || '',
          item.name || '',
          item.categoryNamePath || '',
          JSON.stringify(item)
        ]
      }))
      var processRow = function (row) {
        var finalVal = '';
        for (var j = 0; j < row.length; j++) {
          var innerValue = row[j] === null ? '' : row[j].toString();
          if (row[j] instanceof Date) {
            innerValue = row[j].toLocaleString();
          };
          var result = innerValue.replace(/"/g, '""');
          if (result.search(/("|,|\n)/g) >= 0)
            result = '"' + result + '"';
          if (j > 0)
            finalVal += ',';
          finalVal += result;
        }
        return finalVal + '\n';
      };

      var csvFile = '';
      for (var i = 0; i < rows.length; i++) {
        csvFile += processRow(rows[i]);
      }

      var blob = new Blob([csvFile], { type: 'text/csv;charset=utf-8;' });
      if (navigator.msSaveBlob) {
        navigator.msSaveBlob(blob, filename);
      } else {
        var link = document.createElement("a");
        if (link.download !== undefined) {
          var url = URL.createObjectURL(blob);
          link.setAttribute("href", url);
          link.setAttribute("download", filename);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
    }

    const button = document.createElement('div')
    button.setAttribute('class', 'plugin-menu-button')
    button.innerHTML = '<i class="layui-icon layui-icon-menu-fill" style="font-size: 30px; color: #1E9FFF;"></i>'

    const state = isWaimai ? [
      { value: "0", label: "全部" },
      { value: "1", label: "售卖中" },
      { value: "2", label: "已下架" },
      { value: "8", label: "折扣" },
      { value: "9", label: "单点不送" },
      { value: "3", label: "已售罄" },
      { value: "7", label: "买赠" },
    ] : [
      { value: "0", label: "全部" },
      { value: "1", label: "售卖中" },
      { value: "3", label: "已售罄" },
      { value: "2", label: "已下架" },
      { value: "21", label: "库存不足" },
      { value: "29", label: "限时可售" },
      { value: "30", label: "组合商品" },
    ]

    button.onclick = () => {
      layer.open({
        title: "批量导出",
        type: 1,
        offset: 'l',
        anim: 'slideRight', // 从左往右
        area: ['320px', '100%'],
        shade: 0.1,
        shadeClose: true,
        id: 'ID-demo-layer-direction-l',
        success: function () {
          layui.use('form', function () {
            form.on('submit(demo1)', function (data) {
              var field = data.field; // 获取表单字段值
              startDownloadThread(field);
              return false
            });
          });

        },
        content: `
<div style="padding: 16px;">
  <form class="layui-form" action="">
  <div class="layui-form-item">
    <label class="layui-form-label">门店</label>
    <div class="layui-input-block">
      <select name="store_id" style="display:block; width: 100%; height: 32px;">
        ${storeOptions}
      </select>
    </div>
  </div> 
  <div class="layui-form-item">
    <label class="layui-form-label">商品状态</label>
    <div class="layui-input-block">
      <select name="state" style="display:block; width: 100%; height: 32px;">
      ${state.map(item => `<option value="${item.value}" ${config.state == item.value ? 'selected' : ''}>${item.label}</option>`)}
      </select>
    </div>
  </div> 
  <div class="layui-form-item">
    <label class="layui-form-label">单个文件大小</label>
    <div class="layui-input-block">
      <select name="num_per_file" style="display:block; width: 100%; height: 32px;">
      <option value="1000" ${config.num_per_file == 1000 ? 'selected' : ''}>1000个商品/csv</option>
      <option value="1500" ${config.num_per_file == 1500 ? 'selected' : ''}>1500个商品/csv</option>
      <option value="2000" ${config.num_per_file == 2000 ? 'selected' : ''}>2000个商品/csv</option>
      <option value="3000" ${config.num_per_file == 3000 ? 'selected' : ''}>3000个商品/csv</option>
      </select>
    </div>
  </div> 
  <div class="layui-form-item">
  <label class="layui-form-label">前几页</label>
   <div class="layui-input-block">
    <input type="text" name="max_page" value="${config.max_page}" placeholder="不填默认全部" style="display:block; width: 100%; height: 32px;">
    </div>
 </div>
     <!--div class="layui-form-item">
      <div>开始时间</div>
       <input type="text" class="layui-input" value="${config.end_time}" name="start_time" id="ID-laydate-type-datetime" placeholder="yyyy-MM-dd HH:mm:ss">
    </div-->
      <div class="layui-form-item">
    <div class="layui-input-block">
      <button type="submit" class="layui-btn" lay-submit lay-filter="demo1">开始下载</button>
    </div>
  </div>
</div>`
      });

    }

    document.body.appendChild(button)

  });

}
