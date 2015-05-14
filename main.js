var moment = require('moment')

var mongojs = require('mongojs')
var db = mongojs('mongodb://192.168.2.2/rtl_sdr')
var collection_rtl_power = db.collection('rtl_power')

var spawn = require('child_process').spawn
var spawnSync = require('child_process').spawnSync

// sometimes rtl_power doesn't close
var killrtl = spawnSync('killall -9 rtl_power')

// where we store all the incoming information before we parse it for \n's
var incoming_buffer = ''

var child = spawn('rtl_power', '-f 150M:160M:1k -i 2 -'.split(' '))

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

})

child.stderr.on('data', function (d) {
  console.log('stdrr data')
  console.log(d.toString())
})


process.on('exit', function (code) {
  console.log('killing child ')
  child.stdin.pause()
  child.kill('SIGINT')
  spawnSync('killall -9 rtl_power')

});
