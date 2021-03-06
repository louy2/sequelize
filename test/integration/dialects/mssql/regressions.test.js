'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../../support'),
  Sequelize = Support.Sequelize,
  Op = Sequelize.Op,
  dialect = Support.getTestDialect();

if (dialect.match(/^mssql/)) {
  describe('[MSSQL Specific] Regressions', () => {
    it('does not duplicate columns in ORDER BY statement, #9008', async function() {
      const LoginLog = this.sequelize.define('LoginLog', {
        ID: {
          field: 'id',
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        UserID: {
          field: 'userid',
          type: Sequelize.UUID,
          allowNull: false
        }
      });

      const User = this.sequelize.define('User', {
        UserID: {
          field: 'userid',
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        UserName: {
          field: 'username',
          type: Sequelize.STRING(50),
          allowNull: false
        }
      });

      LoginLog.belongsTo(User, {
        foreignKey: 'UserID'
      });
      User.hasMany(LoginLog, {
        foreignKey: 'UserID'
      });

      await this.sequelize.sync({ force: true });

      const [vyom, shakti, nikita, arya] = await User.bulkCreate([
        { UserName: 'Vayom' },
        { UserName: 'Shaktimaan' },
        { UserName: 'Nikita' },
        { UserName: 'Aryamaan' }
      ], { returning: true });

      await Promise.all([
        vyom.createLoginLog(),
        shakti.createLoginLog(),
        nikita.createLoginLog(),
        arya.createLoginLog()
      ]);

      const logs = await LoginLog.findAll({
        include: [
          {
            model: User,
            where: {
              UserName: {
                [Op.like]: '%maan%'
              }
            }
          }
        ],
        order: [[User, 'UserName', 'DESC']],
        offset: 0,
        limit: 10
      });

      expect(logs).to.have.length(2);
      expect(logs[0].User.get('UserName')).to.equal('Shaktimaan');
      expect(logs[1].User.get('UserName')).to.equal('Aryamaan');
    });
  });

  it('sets the varchar(max) length correctly on describeTable', async function() {
    const Users = this.sequelize.define('_Users', {
      username: Sequelize.STRING('MAX')
    }, { freezeTableName: true });

    await Users.sync({ force: true });
    const metadata = await this.sequelize.getQueryInterface().describeTable('_Users');
    const username = metadata.username;
    expect(username.type).to.include('(MAX)');
  });

  it('sets the char(10) length correctly on describeTable', async function() {
    const Users = this.sequelize.define('_Users', {
      username: Sequelize.CHAR(10)
    }, { freezeTableName: true });

    await Users.sync({ force: true });
    const metadata = await this.sequelize.getQueryInterface().describeTable('_Users');
    const username = metadata.username;
    expect(username.type).to.include('(10)');
  });

  it('saves value bigger than 2147483647, #11245', async function() {
    const BigIntTable =  this.sequelize.define('BigIntTable', {
      business_id: {
        type: Sequelize.BIGINT,
        allowNull: false
      }
    }, {
      freezeTableName: true
    });

    const bigIntValue = 2147483648;

    await BigIntTable.sync({ force: true });

    await BigIntTable.create({
      business_id: bigIntValue
    });

    const record = await BigIntTable.findOne();
    expect(Number(record.business_id)).to.equals(bigIntValue);
  });

  it('saves boolean is true, #12090', async function() {
    const BooleanTable =  this.sequelize.define('BooleanTable', {
      status: {
        type: Sequelize.BOOLEAN,
        allowNull: false
      }
    }, {
      freezeTableName: true
    });

    const value = true;

    await BooleanTable.sync({ force: true });

    await BooleanTable.create({
      status: value
    });

    const record = await BooleanTable.findOne();
    expect(record.status).to.equals(value);
  });
}
