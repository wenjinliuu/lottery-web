# 网页版使用说明

这是一个纯静态彩票号码备忘网页，适合个人使用。

- 开奖数据：`web/data/lottery_draws.json`
- 选号记录：浏览器 IndexedDB 本地保存
- 自动开奖：GitHub Actions 定时运行 `scripts/update-draws.js`
- 备份恢复：网页内“导出备份 / 导入备份”

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
4. 打开 `Settings -> Secrets and variables -> Actions`，新增 repository secret：

```text
JISU_APPKEY
```

值填写极速数据的 appkey。不要把 appkey 写进前端文件或提交到仓库。

5. 打开 `Actions` 页面，手动运行一次 `Deploy GitHub Pages`，确认 Pages 能成功发布。
6. 再手动运行一次 `Update lottery draws`，确认可以抓取开奖数据、提交 `web/data/lottery_draws.json`，并重新部署 Pages。

`Update lottery draws` 会在北京时间 21:50、22:30、23:00 自动运行。

## Cloudflare Pages 部署

如果改用 Cloudflare Pages：

- Build command 留空或填 `None`
- Build output directory 填 `web`
- 仍然建议保留 GitHub Actions 更新 `web/data/lottery_draws.json`
- `JISU_APPKEY` 只需要配置在 GitHub Secrets 里，不需要暴露给 Cloudflare 前端

## 数据备份

选号记录只保存在当前浏览器的 IndexedDB 中。清理浏览器网站数据、换设备、换浏览器、换域名，都不会自动带走记录。

建议定期在“我的”页面点击“导出备份”，生成 `lottery-backup-日期.json`。换设备时打开网页后点击“导入备份”即可恢复本地选号记录。
