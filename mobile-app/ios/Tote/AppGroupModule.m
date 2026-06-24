#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AppGroupModule, NSObject)

RCT_EXTERN_METHOD(getPendingUrls:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getPendingUrlDebugEvents:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearPendingUrls)
RCT_EXTERN_METHOD(clearPendingUrlDebugEvents)

RCT_EXTERN_METHOD(setCollectionsCache:(NSString *)json)

RCT_EXTERN_METHOD(getCollectionsCache:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(enqueuePendingCapture:(NSString *)json)

RCT_EXTERN_METHOD(getPendingCaptures:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearPendingCaptures)

RCT_EXTERN_METHOD(setApiKey:(NSString *)secret)

RCT_EXTERN_METHOD(getApiKey:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(close)

@end
