import Foundation
import React

@objc(AppGroupModule)
class AppGroupModule: NSObject {
  private let pendingUrlsKey = "pendingUrls"
  private let pendingUrlDebugKey = "pendingUrlDebug"

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
    let normalizedUrls = urls
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
    let uniqueUrls = Array(NSOrderedSet(array: normalizedUrls)) as? [String] ?? []

    if uniqueUrls != urls {
      defaults.set(uniqueUrls, forKey: pendingUrlsKey)
      defaults.synchronize()
    }

    resolve(uniqueUrls)
  }

  @objc(getPendingUrlDebugEvents:rejecter:)
  func getPendingUrlDebugEvents(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard let defaults = sharedDefaults() else {
      resolve([])
      return
    }

    resolve(defaults.stringArray(forKey: pendingUrlDebugKey) ?? [])
  }

  @objc
  func clearPendingUrlDebugEvents() {
    sharedDefaults()?.removeObject(forKey: pendingUrlDebugKey)
  }

  @objc
  func clearPendingUrls() {
    sharedDefaults()?.removeObject(forKey: pendingUrlsKey)
  }
}
