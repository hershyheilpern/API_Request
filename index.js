const axios = require('axios');
const { read } = require('node:fs');
const querystring = require('node:querystring');
const uuidv4 = require('uuid').v4;
const cache = {}

const lf = console.log
const clv = console.log//()=>{}
const cli = console.log

function REQSingle(config) {
    lf("function REQSingle")
    return new Promise((resolve, reject) => {
        config.query = config.query || {}
        config.query_data_defaults = config.query_data_defaults || {}
        if(!config.org_limit) config.org_limit = config.query.limit
        if(!config.pages) config.pages = {current:0,total:Math.ceil(config.org_limit/config.max_limit)}
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
        cli("url",httpconfig.url)
        // clv("config",config)
        if(config.cache && cache[httpconfig.url]){
            resolve(cache[httpconfig.url])
        }else{
            axios(httpconfig)
                .then(function (response) {
                    if(config.cache){
                        cache[httpconfig.url] = response
                    }
                    resolve(response)
                })
                .catch(function (error) {
                    // console.log("error",error)
                    reject(error)
                });
        }

    })
}

function REQList(config) {
    lf("function REQList")
    return new Promise((resolve, reject) => {
        // clv("config",config)
        // config.query = config.query || {}
        // config.query_data_defaults = config.query_data_defaults || {}
        // if(!config.org_limit) config.org_limit = config.query.limit
        // if(!config.pages) config.pages = {current:0,total:Math.ceil(config.org_limit/config.max_limit)}
        // clv("config.pages",config.pages,"config.org_limit",config.org_limit,"config.query.limit",config.query.limit)
        // if(config.query.limit > config.max_limit){
        //     config.query.limit = config.max_limit
        // }
        // if(config.org_limit > config.query.limit && config.org_limit - (config.res?.length || 0) < config.query.limit){
        //     config.query.limit = config.org_limit - config.res.length
            
        // }
        // config.query = {...config.query_data_defaults,...config.query}
        // let httpconfig = {
        //     method: config.method,
        //     url: `${config.base_url}${config.v || config.default_v}${config.path}${config.query ? `?${querystring.stringify(config.query)}` : ''}`,
        //     headers: { 'Authorization': `${config.auth_prefix || "Bearer"} ${config.key}`, 'Content-Type': 'application/json', 'accept': 'application/json' },
        //     data: {...config.query,...config.data} || config.query
        // };
        // // if(config.data){
        //     // httpconfig.data = JSON.stringify(config.data)
        // // }
        // if(config.formData){
        //     httpconfig.headers['Content-Type'] = 'multipart/form-data'
        //     httpconfig.data = new FormData()
        //     for (const [key, value] of Object.entries(config.formData)) {
        //         httpconfig.data.append(key, value);
        //     }

        // }
        REQSingle(config).then((response)=>{
            config.pages.current++
            config.res.push(...config.getDataOnly(response))
            if(config.pages.current < config.pages.total && config.getDataOnly(response).length == config.query.limit){
                config.query.after = config.getNext(config,response.data)
                resolve(REQList(config))
            }else{
                // resolve(config.res)
                if(!config.cb?.length){
                    resolve(config)
                }else{
                    // resolve(config)
                    resolve(handleCB(config))
                }
            }
            
        })
    })
}
function handleCB(config){
    lf("function handleCB")
    return new Promise((resolve, reject) => {
        let jobs = []
        let jobCount = 0
        Promise.all(config.res.map((item)=>{
            return createJobs(item,jobs,config)
        }))
        .then((response)=>{
            doJob(jobs,jobCount)
            .then((response)=>{
                config.jobs = jobs
                resolve(config)
            })
            .catch((error)=>{
                console.error("error doJob in function handleCB config:",config,"error",error)
                resolve(config)
            })
        })
        .catch((error)=>{
            console.error("error createing Jobs in function handleCB config:",config,"error",error)
        })

    })
}
function createJobs(initem,jobs,config) {
    lf("function createJobs")
    return new Promise((resolve, reject) => {
        function jobObj(item,cbItem){
            let args = {...cbItem.args} || {}
            cbItem.fill = cbItem.fill || []
            cbItem.fill.forEach((itemk)=>{
                args[itemk.key] = itemk.value_func(item)
            })
            config.config_org = (config.config_org || config?.config || {config:"not found verfgetrbtr"})
            jobs.push({
                // config:{...args,...config.config_org,config_org:config.config_org},
                options:{...args},
                config:{...config.config_org},
                func:cbItem.func,
                item:item,
                res_key:cbItem.res_key,
                res_join:cbItem.res_join,
                cb:cbItem.cb,

            })

        }

        config.cb.forEach((cbItem)=>{
            let item;
            if(!initem){
                try{
                    item = cbItem.item_func(config.item)
                }catch(e){
                    item = undefined
                }
            }else{
                item = initem
            }
            if(Array.isArray(item)){
                item.forEach((v)=>{
                    jobObj(v,cbItem)
                })
            }else if(item){
                jobObj(item,cbItem)
            }
        })
        resolve(jobs)
    })

}

function doJob(jobs,jobCount) {
    lf("function doJob")
    cli("jobCount",jobCount,"/",jobs.length)
    return new Promise((resolve, reject) => {
        jobs[jobCount].func(jobs[jobCount].options,jobs[jobCount].config)
        .then((response)=>{
            resolve(handleJobResponse(jobs,jobCount,response))
        }).catch((error)=>{
            resolve(handleJobResponse(jobs,jobCount,null,error))
        })
    })

}
function handleJobResponse(jobs,jobCount,response,error) {
    lf("function handleJobResponse")
    return new Promise((resolve, reject) => {
        // clv("response",response?.data)

        if(error){
            lf("error")
            jobs[jobCount].item.errors = jobs[jobCount].item.errors || []
            jobs[jobCount].item.errors.push(error)
            resolve(loopNext(jobs,jobCount))
        }else{
            lf("no error")
            if(jobs[jobCount].res_join){
                lf("res_join")
                // clv("jobs[jobCount].item",jobs[jobCount].item)
                // clv("jobs[jobCount].config.getDataOnly(response)",jobs[jobCount].config.getDataOnly(response))
                // jobs[jobCount].item = {...jobs[jobCount].item,...jobs[jobCount].config.getDataOnly(response)}
                
                for (let [key, value] of Object.entries(jobs[jobCount].config.getDataOnly(response))) {
                    jobs[jobCount].item[key] = value
                }
        
            }else{
                lf("no res_join")
                if(!jobs[jobCount].item[jobs[jobCount].res_key]){
                    lf("no jobs[jobCount].item[jobs[jobCount].res_key]")
                    jobs[jobCount].item[jobs[jobCount].res_key] = jobs[jobCount].config.getDataOnly(response)?.[jobs[jobCount].res_key]
                }else{
                    lf("found jobs[jobCount].item[jobs[jobCount].res_key]")
                    jobs[jobCount].item[jobs[jobCount].res_key] = {...jobs[jobCount].item[jobs[jobCount].res_key],...jobs[jobCount].config.getDataOnly(response)?.[jobs[jobCount].res_key]}
                }
            }
            if(jobs[jobCount].cb?.length){
                lf("jobs[jobCount].cb?.length")
                createJobs(null,jobs,jobs[jobCount])
                .then((response)=>{
                    resolve(loopNext(jobs,jobCount))
                })
                .catch((error)=>{
                    console.error("error createing Jobs in function handleJobResponse jobs:",jobs,"jobCount",jobCount,"error",error)
                    resolve(loopNext(jobs,jobCount))
                })
            }else{
                lf("no jobs[jobCount].cb?.length")
                resolve(loopNext(jobs,jobCount))
            }
        }
    })

}
function loopNext(jobs,jobCount) {
    lf("function loopNext")
    return new Promise((resolve, reject) => {
        jobCount++
        if(jobCount < jobs.length){
            setTimeout(()=>{
                resolve(doJob(jobs,jobCount))
            },1)
        }else{
            resolve(jobs)
        }
    })
}

function createJOB(obj) {
    let {config,id} = obj
    let temp = {
        method: config.method,
        url: `${config.base_url}${config.v || config.default_v}${config.path}${config.query ? `?${querystring.stringify(config.query)}` : ''}`,
        headers: { 'Authorization': `${config.auth_prefix || "Bearer"} ${config.key}`, 'Content-Type': 'application/json', 'accept': 'application/json' },
        data: {...config.query,...config.data} || config.query
    }
    if(config.formData){
        temp.headers['Content-Type'] = 'multipart/form-data'
        let formData = new FormData()
        for (let [key, value] of Object.entries(config.data)) {
            formData.append(key, value);
        }
        temp.data = formData
    }
    jobs.push({config:temp})

}
function ALL(config) {
    lf("function ALL, isList: ",config.isList?"true":"false")
    return new Promise((resolve, reject) => {
        let func;
        // if(!config.config_org){
        //     config.config_org = {...config}
        // }
        config.res = config.res || []
        if(config.isList){
            func = REQList
        }else{
            func = REQSingle
        }
        func(config).then((response)=>{
            resolve(response)
        })
        .catch((error)=>{
            reject(error)
        })
    })
}
function temp(){
        let jobs = []
        let res = {
            data:[],
            errors:[],
            responses:[],
        }
        config.query = config.query || {}
        config.query_data_defaults = config.query_data_defaults || {}
        let pages = Math.floor(config.limit/config.max_limit)
        let pagesRemander = config.limit%config.max_limit
        for(let i = 0;i < pages;i++){
        }
}
function xALL(config) {
    return new Promise((resolve, reject) => {
        config.query = config.query || {}
        config.query_data_defaults = config.query_data_defaults || {}
        if(!config.org_limit) config.org_limit = config.query.limit
        if(!config.pages) config.pages = {current:0,total:Math.ceil(config.org_limit/config.query.limit)}
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
                finish({response,config,resolve,reject})
            })
            .catch(function (error) {
                // console.log("error",error)
                reject(error)
            });
    })
}

function finish(obj){
    //set up environment
    let readyToResolveCB = false
    let readyToResolve = false
    let dataToResolve = null

    obj.config.loopObj = {
        loopLevel:0,
        inLoop:false,
        isList:false,
        res:[],
        ...obj.config.loopObj
    }
    obj.config.res.push(...obj.config.getDataOnly(obj.response))
    if(obj.config.loopObj.loopLevel == 0){
        obj.config.pages.current++
        if(obj.config.pages.current < obj.config.pages.total){
            obj.config.query.after = obj.config.getNext(obj.config,obj.response.data)
            readyToResolveCB = false
            readyToResolve = true
            dataToResolve = ALL(config)        
        }else{
            readyToResolveCB = false
            readyToResolve = true
            dataToResolve = obj.response        
            if(obj.config.loopObj.loopLevel == 0 && obj.config.cb?.length){
                onrejectionhandled.config.loopObj.loopLevel = 1
            }
        }
    }


    if(readyToResolve){
        if(obj.config.loopObj.loopLevel == 1){
            //need to come back to save data
            // if(obj.config.loopCount !== undefined){
            //     if(!config.res[config.loopCount][config.cb[config.cbCount].res_key]){
            //         config.res[config.loopCount][config.cb[config.cbCount].res_key] = response.data[config.cb[config.cbCount].res_key]
            //     }else{
            //         config.res[config.loopCount][config.cb[config.cbCount].res_key] = {...config.res[config.loopCount][config.cb[config.cbCount].res_key],...response.data[config.cb[config.cbCount].res_key]}
            //     }
            // }
            if(obj.config.loopOb.loopCount == undefined){
                obj.config.loopObj.loopCount = 0
                obj.config.loopObj[`cbCount_${obj.config.loopObj.loopCount}_${obj.config.loopObj.loopLevel}`] = 0
                obj.config.loopObj.cbRunning = `cbCount_${obj.config.loopObj.loopCount}_${obj.config.loopObj.loopLevel}`
                obj.config.loopObj.activeCBAry = obj.config.cb
            }else{
                if(obj.config.loopObj.activeCBAry[obj.config.loopObj[obj.config.loopObj.cbRunning]+1] == undefined){
                    goUpALevel(obj.config)
                }else{
                    obj.config.loopObj[obj.config.loopObj.cbRunning]++
                }
            }



        }
        if(obj.config.loopObj.loopLevel == 0){
            resolve(dataToResolve)
        }

    }

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


}

function goUpALevel(config){
    if(config.loopObj.loopLevel == 1){
        if((config.loopObj.loopCount+1) == config.res.length){
            config.loopObj.loopCount = 0
        }else{
            config.loopObj.loopCount++
            config.loopObj[`cbCount_${config.loopObj.loopCount}_${config.loopObj.loopLevel}`] = 0
            config.loopObj.cbRunning = `cbCount_${config.loopObj.loopCount}_${config.loopObj.loopLevel}`
            config.loopObj.activeCBAry = config.cb

        }
    }
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