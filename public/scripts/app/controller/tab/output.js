define(['app/controller/tab/tab'], function(Tab) {
    "use strict";

    var OutputTab = Tab.sub({
        el: '#tab_out',
        click: function() {
            this.stack.controllerStack.output.active();
            this.stack.output.active();
        }
    });

    return OutputTab;
});