import Foundation
import React
import Security

@objc(AppGroupModule)
class AppGroupModule: NSObject {
  private let pendingUrlsKey = "pendingUrls"
  private let pendingUrlDebugKey = "pendingUrlDebug"
  private let collectionsCacheKey = "collectionsCache"
  private let pendingCapturesKey = "pendingCaptures"

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

  // MARK: - Collections cache (written by main app, read by extension)

  @objc
  func setCollectionsCache(_ json: String) {
    guard let defaults = sharedDefaults() else { return }
    defaults.set(json, forKey: collectionsCacheKey)
    defaults.synchronize()
  }

  @objc(getCollectionsCache:rejecter:)
  func getCollectionsCache(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    resolve(sharedDefaults()?.string(forKey: collectionsCacheKey))
  }

  // MARK: - Pending captures (written by extension, read by main app)

  @objc
  func enqueuePendingCapture(_ json: String) {
    guard let defaults = sharedDefaults() else { return }
    var captures = defaults.stringArray(forKey: pendingCapturesKey) ?? []
    captures.append(json)
    defaults.set(captures, forKey: pendingCapturesKey)
    defaults.synchronize()
  }

  @objc(getPendingCaptures:rejecter:)
  func getPendingCaptures(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    resolve(sharedDefaults()?.stringArray(forKey: pendingCapturesKey) ?? [])
  }

  @objc
  func clearPendingCaptures() {
    sharedDefaults()?.removeObject(forKey: pendingCapturesKey)
  }

  // MARK: - API Key (Keychain, shared across app + extension)

  private let apiKeyService = "tools.tote.app.share-api-key"
  private let apiKeyAccount = "share-extension"

  @objc
  func setApiKey(_ secret: String) {
    guard let data = secret.data(using: .utf8) else { return }
    let accessGroup = Bundle.main.object(forInfoDictionaryKey: "AppGroup") as? String ?? "group.tools.tote.app"

    let deleteQuery: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: apiKeyService,
      kSecAttrAccount as String: apiKeyAccount,
      kSecAttrAccessGroup as String: accessGroup,
    ]
    SecItemDelete(deleteQuery as CFDictionary)

    let addQuery: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: apiKeyService,
      kSecAttrAccount as String: apiKeyAccount,
      kSecAttrAccessGroup as String: accessGroup,
      kSecValueData as String: data,
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
    ]
    SecItemAdd(addQuery as CFDictionary, nil)
  }

  @objc(getApiKey:rejecter:)
  func getApiKey(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let accessGroup = Bundle.main.object(forInfoDictionaryKey: "AppGroup") as? String ?? "group.tools.tote.app"
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: apiKeyService,
      kSecAttrAccount as String: apiKeyAccount,
      kSecAttrAccessGroup as String: accessGroup,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var result: AnyObject?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    if status == errSecSuccess, let data = result as? Data, let secret = String(data: data, encoding: .utf8) {
      resolve(secret)
    } else {
      resolve(nil)
    }
  }

  // MARK: - Close extension

  @objc
  func close() {
    NotificationCenter.default.post(name: NSNotification.Name("close"), object: nil)
  }
}
