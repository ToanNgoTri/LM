import { configureStore,getDefaultMiddleware } from '@reduxjs/toolkit'
const createSagaMiddleware = require('redux-saga');
const sagaMiddleware = createSagaMiddleware.default();
import { read,searchContent,getlastedlaws,getCountLaw,searchLawDescription} from './fetchData'


import {all,call,takeEvery} from 'redux-saga/effects'
import {saga,saga1,saga3,saga4,saga5,rootReducer} from './fetchData'
import {loader,handle} from './fetchData'

// const sagaMiddleware = createSagaMiddleware()

export function* rootSaga(){
  yield all([
    saga4(),saga3(),saga1(),saga(),saga5()
  ])
}


export const store = configureStore({
    reducer: {read:read.reducer,searchContent:searchContent.reducer,getlastedlaws:getlastedlaws.reducer,getCountLaw:getCountLaw.reducer,searchLawDescription:searchLawDescription.reducer}, // khi sử dụng cái này thì không cần combineReducers
    middleware:(getDefaultMiddleware)=> getDefaultMiddleware({serializableCheck:false, thunk: false}).concat([sagaMiddleware])

    // middleware:(getDefaultMiddleware)=> getDefaultMiddleware().concat([sagaMiddleware])
    //applyMiddleware(...sagaMiddleware)
  })
  
  sagaMiddleware.run(rootSaga)

 