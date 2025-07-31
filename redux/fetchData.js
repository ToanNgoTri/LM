import { createSlice } from '@reduxjs/toolkit'
import {combineReducers} from 'redux'
// import {call,put,takeEvery} from 'redux-saga'
// import dataOrg from '../data/data.json';       ////////////////////////////////////////////// xài tạm
import { call,put,takeEvery,take,takeLatest } from 'redux-saga/effects';
// import { Dirs, FileSystem } from 'react-native-file-access';


export const read = createSlice({
  name: 'read',     
  initialState: {
    content:[],
    info:{},
    loading: false
  },
  reducers: {
    
    loader: (state,action) => {
      state.loading= true;
      state.content=[];
      state.info={};
    },

    handle: (state,action) => {
      state.content=action.payload;
      state.loading= false;
    },

    noLoading: (state,action) => {
      state.loading= false;
    },

}
})

export const searchContent = createSlice({
  name: 'searchContent',     
  initialState: {
    data1:{},
    loading1: false,
    result:false
  },
  reducers: {
    loader1: (state,action) => {
      state.loading1= true;
    },

    handle1: (state,action) => {
      state.result=action.payload;
      state.loading1= false;
    },
}
})

// export const searchLaw = createSlice({
//   name: 'searchLaw',     
//   initialState: {
//     loading2: false,
//     input2:'',
//     info:null,
//   },
//   reducers: {
//     loader2: (state,action) => {
//       state.loading2= true;
//     },

//     handle2: (state,action) => {
//       state.info=action.payload.b;
//       state.loading2= false;
//     },
// }
// })



export const getlastedlaws = createSlice({
  name: 'getlastedlaws',     
  initialState: {
    loading3: false,
    info3:[],
  },
  reducers: {
    loader3: (state,action) => {
      state.loading3= true;
    },

    handle3: (state,action) => {
      state.info3=action.payload.b;
      state.loading3= false;
    },
}
})

export const getCountLaw = createSlice({
  name: 'getCountLaw',     
  initialState: {
    loading4: false,
    result4:0,
  },
  reducers: {
    loader4: (state,action) => {
      state.loading4= true;
    },

    handle4: (state,action) => {
      state.result4=action.payload.b;
      state.loading4= false;
    },
}
})


export const searchLawDescription = createSlice({
  name: 'searchLawDescription',     
  initialState: {
    loading5: false,
    input5:'',
    info5:null,
  },
  reducers: {
    loader5: (state,action) => {
      state.loading5= true;
    },

    handle5: (state,action) => {
      state.info5=action.payload.b;
      state.loading5= false;
    },
}
})


export function* mySaga(state,action){
  
  try{
    yield put(loader())

    let info = yield fetch(`https://us-central1-project2-197c0.cloudfunctions.net/callOneLaw`,{
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body:JSON.stringify({screen:state.lawName})
    })

    let a = yield info.json()



    yield put(handle(a))
    

  }catch(e){

  }
}

export function* mySaga1(state,action){
  try{
    yield put(loader1())

    
    let info = yield  fetch(`https://us-central1-project2-197c0.cloudfunctions.net/searchContent`,{
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body:JSON.stringify({input:state.input})
    })


    let b = yield info.json()


yield put(handle1(b))
  }catch(e){
  }
}

// export function* mySaga2(state,action){
//   try{
        
//     yield put(loader2())
    

//     let info = yield  fetch(`https://us-central1-project2-197c0.cloudfunctions.net/searchLaw`,{
//     // let info = yield  fetch(`http://192.168.1.10:5001/project2-197c0/us-central1/searchLaw`,{
//       method: 'POST',
//       headers: {
//         Accept: 'application/json',
//         'Content-Type': 'application/json',
//       },
//       body:JSON.stringify({input:state.input})
//     })

//     let b = yield info.json()


//     yield put(handle2({b}))
//   }catch(e){
//   }
// }


  export function* mySaga3(state,action){
    yield put(loader3())
  
  
      let info = yield fetch(`https://us-central1-project2-197c0.cloudfunctions.net/getlastedlaws`,{
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        // body:JSON.stringify({screen:1})
      })
      
      let b = yield info.json()
  
  
      yield put(handle3({b}))
    }


    export function* mySaga4(state,action){
      yield put(loader4())
    
    
        let info = yield fetch(`https://us-central1-project2-197c0.cloudfunctions.net/countAllLaw`,{
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          // body:JSON.stringify({screen:1})
        })
        
        let b = yield info.json()
    
    
        yield put(handle4({b}))
      }
  
  
      export function* mySaga5(state,action){
        try{
              
          yield put(loader5())
          
      
          let info = yield  fetch(`https://us-central1-project2-197c0.cloudfunctions.net/searchLawDescription`,{
          // let info = yield  fetch(`http://192.168.1.10:5001/project2-197c0/us-central1/searchLaw`,{
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body:JSON.stringify({input:state.input})
          })
      
          let b = yield info.json()
      
      
          yield put(handle5({b}))
        }catch(e){
        }
      }

      
export function* saga(){
  yield takeEvery('read',mySaga) 
  // yield takeEvery(handle.type,mySaga)    //xài cái này cũng được

}

export function* saga1(){
  yield takeEvery('searchContent',mySaga1)
  // yield takeEvery(handle1.type,mySaga1)

}

export function* saga2(){
  yield takeEvery('searchLaw',mySaga2)

}


export function* saga3(){
  yield takeEvery('getlastedlaws',mySaga3)

}

export function* saga4(){
  yield takeEvery('getCountLaw',mySaga4)

}

export function* saga5(){
  yield takeEvery('searchLawDescription',mySaga5)

}

export const {loader,handle,noLoading} = read.actions;
export const {loader1,handle1} = searchContent.actions;
// export const {loader2,handle2} = searchLaw.actions;
export const {loader3,handle3} = getlastedlaws.actions;
export const {loader4,handle4} = getCountLaw.actions;
export const {loader5,handle5} = searchLawDescription.actions;
