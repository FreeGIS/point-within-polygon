export default {
    input: './src/index.js',
    output: [
      {
        file: './dist/point-in-polygon.js',
        format: 'umd',
        name: 'point-in-polygon'   
        //当入口文件有export时，'umd'格式必须指定name
        //这样，在通过<script>标签引入时，才能通过name访问到export的内容。
      },
      {
        file: './dist/point-in-polygon-es.js',
        format: 'es'
      },
      {
        file: './dist/point-in-polygon-cjs.js',
        format: 'cjs'
      }
    ]
  };