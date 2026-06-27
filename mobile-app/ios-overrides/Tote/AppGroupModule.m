#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AppGroupModule, NSObject)

// Pending URLs (legacy plain-URL queue)
RCT_EXTERN_METHOD(getPendingUrls:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(clearPendingUrls)

// Debug events
RCT_EXTERN_METHOD(getPendingUrlDebugEvents:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(clearPendingUrlDebugEvents)

// Structured captures
RCT_EXTERN_METHOD(enqueuePendingCapture:(NSString *)json)
RCT_EXTERN_METHOD(getPendingCaptures:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(clearPendingCaptures)

// Collections cache
RCT_EXTERN_METHOD(setCollectionsCache:(NSString *)json)
RCT_EXTERN_METHOD(getCollectionsCache:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(clearCollectionsCache)

// API key
RCT_EXTERN_METHOD(setApiKey:(NSString *)secret)
RCT_EXTERN_METHOD(getApiKey:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Close share extension
RCT_EXTERN_METHOD(close)

@end
