export default {
    input: './src/index.js',
    output: [
      {
        file: './dist/point-within-polygon.js',
        format: 'umd',
        name: 'point-within-polygon'   
        //当入口文件有export时，'umd'格式必须指定name
        //这样，在通过<script>标签引入时，才能通过name访问到export的内容。
      },
      {
        file: './dist/point-within-polygon-es.js',
        format: 'es'
      },
      {
        file: './dist/point-within-polygon-cjs.js',
        format: 'cjs'
      }
    ]
  };