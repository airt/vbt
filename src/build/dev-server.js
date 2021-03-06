// @flow

import opn from 'opn'
import http from 'http'
import path from 'path'
import express from 'express'
import webpack from 'webpack'
import createDevMiddleware from 'webpack-dev-middleware'
import createHotMiddleware from 'webpack-hot-middleware'
import createProxyMiddleware from 'http-proxy-middleware'
import createHistoryApiFallback from 'connect-history-api-fallback'

import { dev as config } from '../config'

if (!process.env.NODE_ENV) process.env.NODE_ENV = config.env.NODE_ENV

const { default: webpackConfig } =
  ['testing', 'production'].includes(process.env.NODE_ENV)
    ? require('../config/webpack.prod')
    : require('../config/webpack.dev')

const app = express()
const compiler = webpack(webpackConfig)

const devMiddleware = createDevMiddleware(compiler, {
  publicPath: webpackConfig.output.publicPath,
  quiet: true,
})

const hotMiddleware = createHotMiddleware(compiler, {
  log: false,
  heartbeat: 2000,
})

// currently disabled until this is resolved:
// https://github.com/jantimon/html-webpack-plugin/issues/680
// // force page reload when html-webpack-plugin template changes
// compiler.plugin('compilation', (compilation) => {
//   compilation.plugin('html-webpack-plugin-after-emit', (data, callback) => {
//     hotMiddleware.publish({ action: 'reload' })
//     callback()
//   })
// })

// enable hot-reload and state-preserving
// compilation error display
app.use(hotMiddleware)

// https://github.com/chimurai/http-proxy-middleware
Object.entries(config.proxyTable).forEach(([context, options]) => {
  app.use(createProxyMiddleware(
    (options: any).filter || context,
    typeof options === 'string' ? { target: options } : options,
  ))
})

// handle fallback for html5 history api
app.use(createHistoryApiFallback())

// serve webpack bundle output
app.use(devMiddleware)

// serve pure static assets
const staticPath = path.posix.join(config.assetsPublicPath, config.assetsSubDirectory)

app.use(staticPath, express.static('./static'))

const server = http.createServer(app)

export const start = (): Promise<number> => new Promise((resolve, reject) => {
  server.listen(config.port, (e) => {
    if (e) reject(e)
    console.log(`> server started at port ${config.port}\n`)
  })

  devMiddleware.waitUntilValid(() => {
    const url = `http://localhost:${server.address().port}`
    console.log(`> listening at ${url}\n`)
    if (process.env.NODE_ENV === 'development') {
      opn(url)
    }
    resolve(0)
  })
})

export const close = () => {
  server.close()
}

export default {
  start,
  close,
}

if (require.main === module) {
  start()
}
