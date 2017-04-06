/*
This file is part of the Juju GUI, which lets users view and manage Juju
environments within a graphical interface (https://launchpad.net/juju-gui).
Copyright (C) 2017 Canonical Ltd.

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU Affero General Public License version 3, as published by
the Free Software Foundation.

This program is distributed in the hope that it will be useful, but WITHOUT
ANY WARRANTY; without even the implied warranties of MERCHANTABILITY,
SATISFACTORY QUALITY, or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero
General Public License for more details.

You should have received a copy of the GNU Affero General Public License along
with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

'use strict';

var juju = {components: {}}; // eslint-disable-line no-unused-vars

chai.config.includeStack = true;
chai.config.truncateThreshold = 0;

describe('HeaderLogo', function() {

  beforeAll(function(done) {
    // By loading this file it adds the component to the juju components.
    YUI().use('header-logo', function() { done(); });
  });

  it('renders for gisf', () => {
    const renderer = jsTestUtils.shallowRender(
      <juju.components.HeaderLogo
        gisf={true} />, true);
    const output = renderer.getRenderOutput();
    const expected = (
      <a href="/" role="button" title="Home">
        <juju.components.SvgIcon name="juju-logo"
          className="svg-icon"
          width="90" height="35" />
      </a>);
    expect(output).toEqualJSX(expected);
  });

  it('renders for gijoe', () => {
    const showProfile = sinon.stub();
    const renderer = jsTestUtils.shallowRender(
      <juju.components.HeaderLogo
        gisf={false}
        showProfile={showProfile} />, true);
    const output = renderer.getRenderOutput();
    const expected = (
      <a onClick={showProfile} role="button" title="Home">
        <juju.components.SvgIcon name="juju-logo"
          className="svg-icon"
          width="90" height="35" />
      </a>);
    expect(output).toEqualJSX(expected);
  });

  it('calls showProfil on click in gisf', () => {
    const showProfile = sinon.stub();
    const preventDefault = sinon.stub();
    const renderer = jsTestUtils.shallowRender(
      <juju.components.HeaderLogo
        showProfile={showProfile}/>, true);
    const output = renderer.getRenderOutput();
    // Call the click handler
    output.props.onClick({preventDefault});
    assert.equal(preventDefault.callCount, 1);
    assert.equal(showProfile.callCount, 1);
  });
});
