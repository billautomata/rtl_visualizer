// var pg = require('pg')
// var conString = 'postgres://dev:dev@localhost/rtl_sdr'
//
// //this starts initializes a connection pool
// //it will keep idle connections open for a (configurable) 30 seconds
// //and set a limit of 20 (also configurable)
// pg.connect(conString, function(err, client, done) {
//   if(err) {
//     return console.error('error fetching client from pool', err);
//   }
//   client.query('SELECT $1::int AS number', ['1'], function(err, result) {
//     //call `done()` to release the client back to the pool
//     done();
//
//     if(err) {
//       return console.error('error running query', err);
//     }
//     console.log(result.rows[0].number);
//     //output: 1
//   });
// });

var moment = require('moment')

var mongojs = require('mongojs')
var db = mongojs('mongodb://192.168.2.2/rtl_sdr')
var collection_rtl_power = db.collection('rtl_power')




//
// var mongoose = require('mongoose');
// mongoose.connect('mongodb://localhost/rtl_sdr');
//
// var db = mongoose.connection
// db.once('open', function (cb) {
//   console.log('database opened')
// })
// db.on('error', console.error.bind(console, 'connection error:'));
//
// var DataPoint = mongoose.model('rtlpower_reading', {
//
// })

//
// var Cat = mongoose.model('Cat', { name: String });
//
// var kitty = new Cat({ name: 'Zildjian' });
// kitty.save(function (err) {
//   if (err) // ...
//   console.log('meow');
// });

//
//
//
var spawn = require('child_process').spawn
var spawnSync = require('child_process').spawnSync

// sometimes it doesn't close
var killrtl = spawnSync('killall -9 rtl_power')

var incoming_buffer = ''

var data_points = []

var child = spawn('rtl_power', '-f 929M:932M:1k -i 2 -'.split(' '))

child.stdout.on('data', function (d) {

  // add the incoming data to the buffer
  incoming_buffer += d.toString()

  // split the existing buffer
  var split_buffer = incoming_buffer.split('\n')

  if (split_buffer.length > 1) {
    // take the last chunk and keep it as the new incoming buffer
    incoming_buffer = split_buffer[split_buffer.length - 1]
  }

  // remove that last element
  split_buffer = split_buffer.slice(0, split_buffer.length - 1)


  // now split_buffer is an array of correctly formatted csv entries
  split_buffer.forEach(function (sb, idx) {

    var b = sb.split(',')

    var readings_array = []
    for (var ridx = 6; ridx < b.length; ridx++) {

      if(b[ridx].indexOf('2015') !== -1 || b[ridx].indexOf(':') !== -1){
        console.log('error bad readings parse!')
        console.log(b[ridx])
      }

      if(parseFloat(b[ridx]) > 1000){
        // search for fucked up readings, bad csv parsings
        console.log(b[ridx])
        console.log("ERRRRORRRRRR",parseFloat(b[ridx]))
      }
      readings_array.push(parseFloat(b[ridx]))
    }

    // date, time, Hz low, Hz high, Hz step, samples, dbm, dbm,

    var data_point = {
      date_time: new moment(b[0] + b[1]).toString(),
      hz_lo: parseFloat(b[2]),
      hz_hi: parseFloat(b[3]),
      hz_step: parseFloat(b[4]),
      samples: parseFloat(b[5]),
      readings: readings_array
    }

    // console.log(data_point)

    collection_rtl_power.save(data_point,function(err,d){
      // console.log('done saving data point')
      console.log(d._id,'readings stored',d.readings.length)
    })

  })


  return;
  //
  // var blobs = d.toString().split('\n')
  //
  // // filter the empty entries
  // blobs = blobs.filter(function (b) {
  //   return b.length > 0
  // })
  //
  // blobs.forEach(function (blob) {
  //
  //   var b = blob.split(',')
  //
  //   var readings_array = []
  //   for (var ridx = 6; ridx < b.length; ridx++) {
  //     readings_array.push(parseFloat(b[ridx]))
  //   }
  //
  //   // date, time, Hz low, Hz high, Hz step, samples, dbm, dbm,
  //
  //   var data_point = {
  //       date_time: new moment(b[0] + b[1]).toString(),
  //       hz_lo: parseFloat(b[2]),
  //       hz_hi: parseFloat(b[3]),
  //       hz_step: parseFloat(b[4]),
  //       samples: parseFloat(b[5]),
  //       readings: readings_array
  //     }
  //     //
  //     collection_rtl_power.save(data_point,function(err,d){
  //       console.log('done saving data point')
  //       console.log(d)
  //     })
  //
  //   // console.log(JSON.stringify(data_point, null, 2))
  //
  // })

})

child.stderr.on('data', function (d) {
  console.log('stdrr data')
  console.log(d.toString())
})


process.on('exit', function (code) {
  console.log('killing child ')
  child.stdin.pause()
  child.kill('SIGHUP')
  spawnSync('killall -9 rtl_power')

});
