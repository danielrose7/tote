#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AppGroupModule, NSObject)

RCT_EXTERN_METHOD(getPendingUrls:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearPendingUrls)

@end
