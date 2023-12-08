// ==UserScript==
// @name        exportor
// @namespace   zhangfake meituan_exporter
// @match       *://shangoue.meituan.com/
// @grant       GM_xmlhttpRequest
// @grant       GM_setValue
// @grant       GM_getValue
// @version     1.1
// @author      -
// @description 2023/6/19 18:18:00
// @run-at      document-idle
// @require     https://unpkg.com/layui@2.8.7/dist/layui.js
// @downloadURL https://raw.githubusercontent.com/zhangfake/meituan_exporter/main/exportor.js
// ==/UserScript==

const styleSheet = document.createElement('link');
styleSheet.setAttribute("href", "https://unpkg.com/layui@2.8.7/dist/css/layui.css")
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
  let config = JSON.parse(GM_getValue('config', '{"start_time":"", "store_id": ""}'))

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

    let totalItem = 1, page = 1; pageSize = 100;
    let products = []
    do {
      layer.msg("正在读取第" + page + "页数据")
      let pageData = await fetch("https://shangoue.meituan.com/reuse/sc/product/retail/r/searchListPage", {
        "headers": {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        "body": `wmPoiId=${config.store_id}&pageNum=${page}&pageSize=${pageSize}&needTag=0&name=&brandId=0&tagId=0&searchWord=&state=${config.state}&saleStatus=0&limitSale=0&needCombinationSpu=2&noStockAutoClear=-1`,
        "method": "POST",
      }).then(e => e.json())
      products = products.concat(pageData.data.productList)
      totalItem = pageData.data.totalCount
      page++
      console.log(page, products)
      if (page > Math.ceil(totalItem / pageSize)) {
        break;
      }
    } while (true)
    if (!products.length) {
      layer.msg('没有数据可以导出', { icon: 1 });
      return;
    }
    let csv = [["美团ID", "美团名称", "美团类目", "美团商品原始数据"]].concat(products.map(item => {
      return [
        item.id || '',
        item.name || '',
        item.categoryNamePath || '',
        JSON.stringify(item)
      ]
    }))
    exportToCsv('data.csv', csv)
    layer.closeAll('loading')
  }
  function exportToCsv(filename, rows) {
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
          laydate.render({
            elem: '#ID-laydate-type-datetime',
            type: 'datetime',
            fullPanel: true // 2.8+
          });

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
      <option value="0" selected>全部</option>
      <option value="1" >售卖中</option>
      <option value="3" >已售罄</option>
      <option value="2" >已下架</option>
      <option value="21" >库存不足</option>
      <option value="29" >限时可售</option>
      <option value="30" >组合商品</option>
      </select>
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
