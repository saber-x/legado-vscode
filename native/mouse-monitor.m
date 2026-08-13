#import <AppKit/AppKit.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
  CFMachPortRef eventTap;
  NSPoint mousePosition;
  CFAbsoluteTime ignoreMouseMoveUntil;
  CFAbsoluteTime lastWheelEvent;
  double mouseMoveDelay;
} MonitorState;

static CGEventRef handleScroll(CGEventTapProxy proxy, CGEventType type,
                               CGEventRef event, void *userInfo) {
  MonitorState *state = (MonitorState *)userInfo;
  if (type == kCGEventTapDisabledByTimeout ||
      type == kCGEventTapDisabledByUserInput) {
    if (state->eventTap) {
      CGEventTapEnable(state->eventTap, true);
    }
    return event;
  }
  if (type != kCGEventScrollWheel) {
    return event;
  }

  int64_t momentum =
      CGEventGetIntegerValueField(event, kCGScrollWheelEventMomentumPhase);
  int64_t phase = CGEventGetIntegerValueField(event, kCGScrollWheelEventScrollPhase);
  if (momentum != 0 || (phase != 0 && phase != 1 && phase != 128)) {
    return event;
  }

  int64_t delta = CGEventGetIntegerValueField(event, kCGScrollWheelEventDeltaAxis1);
  if (delta == 0) {
    delta = CGEventGetIntegerValueField(event, kCGScrollWheelEventPointDeltaAxis1);
  }
  if (delta == 0) {
    return event;
  }

  CFAbsoluteTime now = CFAbsoluteTimeGetCurrent();
  if (now - state->lastWheelEvent < 0.25) {
    return event;
  }
  state->lastWheelEvent = now;
  state->mousePosition = [NSEvent mouseLocation];
  state->ignoreMouseMoveUntil = now + state->mouseMoveDelay;
  puts(delta > 0 ? "previous" : "next");
  fflush(stdout);
  return event;
}

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    double mouseMoveDelay = argc > 1 ? strtod(argv[1], NULL) : 3.0;
    if (mouseMoveDelay < 0 || mouseMoveDelay > 60) {
      mouseMoveDelay = 3.0;
    }
    BOOL wheelEnabled = argc <= 2 || strcmp(argv[2], "0") != 0;
    MonitorState state = {
        .eventTap = NULL,
        .mousePosition = [NSEvent mouseLocation],
        .ignoreMouseMoveUntil = CFAbsoluteTimeGetCurrent() + mouseMoveDelay,
        .lastWheelEvent = 0,
        .mouseMoveDelay = mouseMoveDelay,
    };
    CGEventMask eventMask = CGEventMaskBit(kCGEventScrollWheel);
    CFMachPortRef eventTap = wheelEnabled
        ? CGEventTapCreate(kCGSessionEventTap, kCGTailAppendEventTap,
                           kCGEventTapOptionListenOnly, eventMask, handleScroll,
                           &state)
        : NULL;
    state.eventTap = eventTap;
    if (wheelEnabled && !eventTap) {
      CGRequestListenEventAccess();
      puts("permission-required");
      fflush(stdout);
    } else if (eventTap) {
      CFRunLoopSourceRef source =
          CFMachPortCreateRunLoopSource(kCFAllocatorDefault, eventTap, 0);
      CFRunLoopAddSource(CFRunLoopGetCurrent(), source, kCFRunLoopCommonModes);
      CGEventTapEnable(eventTap, true);
      puts("ready");
      fflush(stdout);
      CFRelease(source);
    }

    while (1) {
      CFRunLoopRunInMode(kCFRunLoopDefaultMode, 0.05, false);
      NSPoint current = [NSEvent mouseLocation];
      if (CFAbsoluteTimeGetCurrent() < state.ignoreMouseMoveUntil) {
        state.mousePosition = current;
        continue;
      }
      if (current.x != state.mousePosition.x ||
          current.y != state.mousePosition.y) {
        puts("moved");
        fflush(stdout);
        if (eventTap) {
          CFRelease(eventTap);
        }
        return 0;
      }
    }
  }
}
