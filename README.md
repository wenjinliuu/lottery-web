[WEB_VERSION.md](https://github.com/user-attachments/files/27561843/WEB_VERSION.md)
# 彩票夹 v2.0

这是一个本地优先的纯静态彩票记录工具，支持号码试玩、票夹核对、月度统计、离线使用和本地 OCR。

- 开奖数据：读取 `lottery-data-repo` 的公开 JSON
- 彩票记录：浏览器 IndexedDB 本地保存，可标记中奖票据是否已兑奖
- 自动开奖：由独立数据仓库 `lottery-data-repo` 负责
- 下期开奖：日历 API 延迟时显示仓库推算值，官方数据更新后自动确认或纠正待开奖记录
- 数据状态：“我的”页面集中显示开奖仓库、日历、下期状态、PWA 和备份健康
- 月度统计：按开奖日期展示每日盈亏、彩种占比和近六个月对比
- 备份恢复：网页内“导出备份 / 导入备份”，超过 7 天自动提醒
- 扫描彩票：票夹页可在本机识别双色球、大乐透单式票，确认后导入彩票记录
- PWA：支持添加到手机桌面，并缓存应用外壳与最近成功读取的开奖 JSON

> 本项目仅用于试玩、记录和辅助核对，不销售、不代购彩票。实际开奖结果以官方渠道公布为准；如需购买，请通过当地合法、正规线下彩票销售渠道并理性参与。

## 扫描彩票

“扫描彩票”使用浏览器端 Tesseract.js，本地完成动态票面裁剪、号码区复核、OCR 和号码规则校验。彩票图片不会上传，也不会保存到 IndexedDB；只有用户确认后的彩种、期号、号码、倍数和金额会写入本地选号记录。

复核页支持放大原票逐项核对，并可通过号码球补录漏识别的一注。号码区会结合大乐透虚线分隔、双色球 A–E 行号和多组比例区域识别，不按固定票长或固定注数裁切。

OCR 引擎和中英文模型仅在用户首次点击扫描时按需下载，之后由浏览器缓存。当前支持双色球、大乐透普通单式票；复式、胆拖和多期投注需要手动记录。

## 本地预览

在项目根目录运行：

```bash
python -m http.server 5173 --directory web
```

然后打开：

```text
http://127.0.0.1:5173/
```

不要直接双击 `web/index.html` 使用，因为浏览器可能禁止直接读取本地 JSON。

## GitHub Pages 部署

本项目保留 `web/` 作为静态网页目录。GitHub Pages 分支目录模式通常只支持仓库根目录或 `/docs`，所以本项目使用 GitHub Actions 发布 `web/` 目录。

1. 把项目推送到 GitHub 仓库的 `main` 分支。
2. 打开仓库 `Settings -> Pages`。
3. 在 `Build and deployment` 中将 `Source` 设为 `GitHub Actions`。
4. 本仓库不需要配置极速数据 API key。开奖数据由独立数据仓库更新：

```text
https://github.com/wenjinliuu/lottery-data-repo
```

5. 打开 `Actions` 页面，手动运行一次 `Deploy GitHub Pages`，确认 Pages 能成功发布。

## Cloudflare Pages 部署

如果改用 Cloudflare Pages：

- Build command 留空或填 `None`
- Build output directory 填 `web`
- 不需要配置 `JISU_APPKEY`
- 前端会直接读取 `lottery-data-repo` 的公开开奖 JSON

## PWA 与离线使用

首次在线打开后，浏览器会注册 Service Worker。支持的浏览器会在“数据状态中心”显示“安装到桌面”。离线状态下可以查看本地记录和已缓存页面；开奖数据可能来自最近一次成功缓存，页面会明确显示离线状态。

## 数据备份

彩票记录只保存在当前浏览器的 IndexedDB 中。清理浏览器网站数据、换设备、换浏览器、换域名，都不会自动带走记录。

建议定期在“我的”页面点击“导出备份”，生成 `lottery-backup-日期.json`。换设备时打开网页后点击“导入备份”即可恢复本地选号记录。
