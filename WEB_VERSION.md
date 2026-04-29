# 网页版使用说明

这是一个纯静态彩票号码备忘网页，适合个人使用。

- 开奖数据：读取 `lottery-data-repo` 的公开 JSON
- 选号记录：浏览器 IndexedDB 本地保存
- 自动开奖：由独立数据仓库 `lottery-data-repo` 负责
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

## 数据备份

选号记录只保存在当前浏览器的 IndexedDB 中。清理浏览器网站数据、换设备、换浏览器、换域名，都不会自动带走记录。

建议定期在“我的”页面点击“导出备份”，生成 `lottery-backup-日期.json`。换设备时打开网页后点击“导入备份”即可恢复本地选号记录。
