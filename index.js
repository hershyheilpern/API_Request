const axios = require('axios');
const { read } = require('node:fs');
const querystring = require('node:querystring');
function ALL(config) {
    return new Promise((resolve, reject) => {
        config.query = config.query || {}
        config.query_data_defaults = config.query_data_defaults || {}
        if(!config.org_limit) config.org_limit = config.query.limit
        if(config.query.limit > config.max_limit){
            config.query.limit = config.max_limit
        }
        if(config.org_limit > config.query.limit && config.org_limit - (config.res?.length || 0) < config.query.limit){
            config.query.limit = config.org_limit - config.res.length
            
        }
        config.query = {...config.query_data_defaults,...config.query}
        let httpconfig = {
            method: config.method,
            url: `${config.base_url}${config.v || config.default_v}${config.path}${config.query ? `?${querystring.stringify(config.query)}` : ''}`,
            headers: { 'Authorization': `${config.auth_prefix || "Bearer"} ${config.key}`, 'Content-Type': 'application/json', 'accept': 'application/json' },
            data: {...config.query,...config.data} || config.query
        };
        // if(config.data){
            // httpconfig.data = JSON.stringify(config.data)
        // }
        if(config.formData){
            httpconfig.headers['Content-Type'] = 'multipart/form-data'
            httpconfig.data = new FormData()
            for (const [key, value] of Object.entries(config.formData)) {
                httpconfig.data.append(key, value);
            }

        }
        console.log("httpconfig",httpconfig.url)
        axios(httpconfig)
            .then(function (response) {
                let readyToResolveCB = false
                let readyToResolve = false
                let dataToResolve = null
                if(config.getAll && config.isList){
                    // console.log("response",response)
                    config.res = config.res || []
                    config.res.push(...config.getDataOnly(response))
                    console.log("config.res.length",config.res.length,"config.org_limit",config.org_limit,"config.query.limit",config.query.limit)
                    if(config.res.length < config.org_limit && !config.inLoop){
                        if(config.getDataOnly(response).length < config.query.limit){
                            readyToResolveCB = true
                            readyToResolve = true
                            dataToResolve = config.res       

                            // return resolve(config.res)
                        }else
                        if(config.getNext(config,response.data)){
                            config.query.after = config.getNext(config,response.data)
                            readyToResolveCB = false
                            readyToResolve = true
                            dataToResolve = ALL(config)        

                            // return resolve(ALL(config))
                        }
                    }else{
                        readyToResolve = true
                        dataToResolve = config.res
                        if(!config.cb || !config.inLoop){
                            readyToResolveCB = true
                            readyToResolve = true
                            dataToResolve = response        
                            // resolve(config.res)
                        }
                    }
                }else{
                    readyToResolveCB = true
                    readyToResolve = true
                    dataToResolve = response
                    // resolve(response)
                }
                if(readyToResolve){
                    if(config.cb && readyToResolveCB){
                        // if(config.cb.func){
                            if(config.loopCount !== undefined){
                                if(!config.res[config.loopCount][config.cb[config.cbCount].res_key]){
                                    config.res[config.loopCount][config.cb[config.cbCount].res_key] = response.data[config.cb[config.cbCount].res_key]
                                }else{
                                    config.res[config.loopCount][config.cb[config.cbCount].res_key] = {...config.res[config.loopCount][config.cb[config.cbCount].res_key],...response.data[config.cb[config.cbCount].res_key]}
                                }
                            }
                            // config.loopCount = config.loopCount+1 || 0
                            if(config.loopCount == undefined){
                                config.loopCount = 0
                                config.cbCount = 0
                            }else{
                                if(config.cb[config.cbCount+1] == undefined){
                                    config.cbCount = 0
                                    config.loopCount++
                                }else{
                                    config.cbCount++
                                }
                            }
                            config.inLoop = true
                            // config.loopAry = config.res
                            config.isList = false
                            let args = {...config.cb[config.cbCount].args} || {}
                            config.cb[config.cbCount].fill = config.cb[config.cbCount].fill || []
                            if(config.loopCount < config.res.length){
                                config.cb[config.cbCount].fill.forEach((item)=>{
                                    args[item.key] = item.value_func(config.res[config.loopCount])
                                })
                                resolve(config.cb[config.cbCount].func(args,config))
                            }else{
                                // console.log("config.res",config.res)
                                resolve(config.res)
                            }
                        // }else{
                        //     resolve(config.res)
                        // }
                    }else{
                        resolve(dataToResolve)
                    }
                }
            })
            .catch(function (error) {
                // console.log("error",error)
                reject(error)
            });
    })
}

function PUT(config) {
    config.method = 'put'
    return ALL(config)
}
function POST(config) {
    config.method = 'post'
    return ALL(config)
}
function GET(config) {
    config.method = 'get'
    return ALL(config)
}

exports.PUT = PUT
exports.POST = POST
exports.GET = GET
exports.ALL = ALL