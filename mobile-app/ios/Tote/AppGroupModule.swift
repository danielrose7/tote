import Foundation
import React

@objc(AppGroupModule)
class AppGroupModule: NSObject {
  private let pendingUrlsKey = "pendingUrls"

  private func sharedDefaults() -> UserDefaults? {
    guard let appGroup = Bundle.main.object(forInfoDictionaryKey: "AppGroup") as? String else {
      return nil
    }

    return UserDefaults(suiteName: appGroup)
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(getPendingUrls:rejecter:)
  func getPendingUrls(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard let defaults = sharedDefaults() else {
      resolve([])
      return
    }

    let urls = defaults.stringArray(forKey: pendingUrlsKey) ?? []
    resolve(urls)
  }

  @objc
  func clearPendingUrls() {
    sharedDefaults()?.removeObject(forKey: pendingUrlsKey)
  }
}
