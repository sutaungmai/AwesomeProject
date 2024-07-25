<script src="http://localhost:8097"></script>;

import React, {useEffect} from 'react';
import {useState} from 'react';

import {PermissionsAndroid, Platform} from 'react-native';

import {
  InterfaceType,
  StarConnectionSettings,
  StarXpandCommand,
  StarPrinter,
  StarDeviceDiscoveryManager,
  StarDeviceDiscoveryManagerFactory,
} from 'react-native-star-io10';
import WebView from 'react-native-webview';
import {OrderProduct, ReceiptFormat} from './types';
import {
  formatDate,
  formatNumber,
  formatReceiptItem,
  formatSubtotal,
  padString,
} from './utils';

export default function App() {
  const webviewRef = React.useRef(null);
  const [interfaceType, setInterfaceType] = useState(InterfaceType.Lan);
  const [identifier, setIdentifier] = useState('');
  const [lanIsEnabled, setLanIsEnabled] = useState(true);
  const [manager, setManager] = useState<
    StarDeviceDiscoveryManager | undefined
  >(undefined);

  async function printerDiscovery() {
    try {
      await manager?.stopDiscovery();

      var interfaceTypes: Array<InterfaceType> = [];
      if (lanIsEnabled) {
        interfaceTypes.push(InterfaceType.Lan);
      }
      setManager(
        await StarDeviceDiscoveryManagerFactory.create(interfaceTypes),
      );
    } catch (error) {
      console.log(`Error: ${String(error)}`);
    }
  }

  useEffect(() => {
    const _startDiscovery = async () => {
      if (manager != undefined) {
        manager.discoveryTime = 10000;

        const printers: {name: string; ipAddress: string}[] = [];
        manager.onPrinterFound = async (printer: StarPrinter) => {
          const info = printer._information?.reserved;
          if (info) {
            const requiredPrinterInfo = {
              name: info.get('name'),
              ipAddress: info.get('ipAddress'),
            };

            printers.push(requiredPrinterInfo);
          }
        };

        manager.onDiscoveryFinished = () => {
          if (webviewRef.current) {
            (webviewRef.current as any).postMessage(JSON.stringify(printers));
          }
          console.log(`Discovery finished.`);
        };

        try {
          console.log(`Discovery start.`);
          await manager.startDiscovery();
        } catch (error) {
          console.log(`Error: ${String(error)}`);
        }
      }
    };
    _startDiscovery();
  }, [manager]);

  async function printOrder(data: OrderProduct[], ip?: string) {
    var settings = new StarConnectionSettings();
    settings.interfaceType = interfaceType;
    settings.identifier = ip || identifier;

    // If you are using Android 12 and targetSdkVersion is 31 or later,
    // you have to request Bluetooth permission (Nearby devices permission) to use the Bluetooth printer.
    // https://developer.android.com/about/versions/12/features/bluetooth-permissions
    if (Platform.OS == 'android' && 31 <= Platform.Version) {
      if (
        interfaceType == InterfaceType.Bluetooth ||
        settings.autoSwitchInterface == true
      ) {
        var hasPermission = await _confirmBluetoothPermission();

        if (!hasPermission) {
          console.error(
            `PERMISSION ERROR: You have to allow Nearby devices to use the Bluetooth printer`,
          );
          return;
        }
      }
    }

    let subTotal = 0;
    let totalMva = 0;
    let totalDiscount = 0;
    const products: ReceiptFormat[] = data.map(product => {
      subTotal += product.unitPriceExVat * product.quantity;
      totalMva +=
        product.unitPriceExVat * product.quantity * (product.vatPercent / 100);
      totalDiscount +=
        product.unitPriceExVat *
        product.quantity *
        (product.discountPercent / 100);
      return {
        name: product.name,
        quantity: product.quantity,
        price: product.unitPriceExVat * (1 + product.vatPercent / 100),
        extras: product.extras.map(extra => {
          subTotal += extra.unitPriceExVat * extra.quantity;

          totalMva +=
            extra.unitPriceExVat * extra.quantity * (extra.vatPercent / 100);

          totalDiscount +=
            extra.unitPriceExVat *
            extra.quantity *
            (extra.discountPercent / 100);
          return {
            name: extra.name,
            quantity: extra.quantity * product.quantity,
            price: extra.unitPriceExVat * (1 + extra.vatPercent / 100),
          };
        }),
      };
    });

    var printer = new StarPrinter(settings);

    try {
      // TSP100III series and TSP100IIU+ do not support actionPrintText because these products are graphics-only printers.
      // Please use the actionPrintImage method to create printing data for these products.
      // For other available methods, please also refer to "Supported Model" of each method.
      // https://www.star-m.jp/products/s_print/sdk/react-native-star-io10/manual/en/api-reference/star-xpand-command/printer-builder/action-print-image.html
      var builder = new StarXpandCommand.StarXpandCommandBuilder();

      builder.addDocument(
        new StarXpandCommand.DocumentBuilder().addPrinter(
          new StarXpandCommand.PrinterBuilder()
            .styleAlignment(StarXpandCommand.Printer.Alignment.Center)
            .actionPrintImage(
              new StarXpandCommand.Printer.ImageParameter('buylink.png', 250),
            )
            .actionPrintText(
              '\nKlæbuveien 122 ' +
                '\n7031, Trondheim' +
                '\nBuylink AS' +
                `\n${formatDate(new Date())}`,
            )
            .styleAlignment(StarXpandCommand.Printer.Alignment.Left)
            .styleBold(true)
            .actionPrintText(
              'Product                         Qty      Unit pr\n',
            )
            .styleBold(false)
            .styleFont(StarXpandCommand.Printer.FontType.B)
            .actionPrintText(formatReceiptItem(products))
            .actionPrintText(
              formatSubtotal(
                formatNumber(subTotal + totalMva),
                formatNumber(totalMva),
                formatNumber(totalDiscount),
              ),
            )
            .styleFont(StarXpandCommand.Printer.FontType.A)
            .actionPrintText(padString('\nTotal', 28))
            .add(
              new StarXpandCommand.PrinterBuilder()
                .styleMagnification(
                  new StarXpandCommand.MagnificationParameter(2, 2),
                )
                .actionPrintText(
                  padString(`${formatNumber(subTotal + totalMva)}`, 10, true) +
                    '\n',
                ),
            )
            .actionCut(StarXpandCommand.Printer.CutType.Partial),
        ),
      );

      var commands = await builder.getCommands();

      await printer.open();
      await printer.print(commands);
    } catch (error) {
      console.error(`Error: ${String(error)}`);
    } finally {
      await printer.close();
      await printer.dispose();
    }
  }

  async function testPrint(ip?: string) {
    var settings = new StarConnectionSettings();
    settings.interfaceType = interfaceType;
    settings.identifier = ip || identifier;

    // If you are using Android 12 and targetSdkVersion is 31 or later,
    // you have to request Bluetooth permission (Nearby devices permission) to use the Bluetooth printer.
    // https://developer.android.com/about/versions/12/features/bluetooth-permissions
    if (Platform.OS == 'android' && 31 <= Platform.Version) {
      if (
        interfaceType == InterfaceType.Bluetooth ||
        settings.autoSwitchInterface == true
      ) {
        var hasPermission = await _confirmBluetoothPermission();

        if (!hasPermission) {
          console.error(
            `PERMISSION ERROR: You have to allow Nearby devices to use the Bluetooth printer`,
          );
          return;
        }
      }
    }

    var printer = new StarPrinter(settings);

    try {
      // TSP100III series and TSP100IIU+ do not support actionPrintText because these products are graphics-only printers.
      // Please use the actionPrintImage method to create printing data for these products.
      // For other available methods, please also refer to "Supported Model" of each method.
      // https://www.star-m.jp/products/s_print/sdk/react-native-star-io10/manual/en/api-reference/star-xpand-command/printer-builder/action-print-image.html
      var builder = new StarXpandCommand.StarXpandCommandBuilder();

      builder.addDocument(
        new StarXpandCommand.DocumentBuilder().addPrinter(
          new StarXpandCommand.PrinterBuilder()
            .styleAlignment(StarXpandCommand.Printer.Alignment.Center)
            .actionPrintText('Hello World\n')
            .actionCut(StarXpandCommand.Printer.CutType.Partial),
        ),
      );

      var commands = await builder.getCommands();

      await printer.open();
      await printer.print(commands);
    } catch (error) {
      console.error(`Error: ${String(error)}`);
    } finally {
      await printer.close();
      await printer.dispose();
    }
  }

  async function _onPressOpenCashDrawerButton() {
    var settings = new StarConnectionSettings();
    settings.interfaceType = interfaceType;
    settings.identifier = identifier;
    // settings.autoSwitchInterface = true;

    // If you are using Android 12 and targetSdkVersion is 31 or later,
    // you have to request Bluetooth permission (Nearby devices permission) to use the Bluetooth printer.
    // https://developer.android.com/about/versions/12/features/bluetooth-permissions
    if (Platform.OS == 'android' && 31 <= Platform.Version) {
      if (
        interfaceType == InterfaceType.Bluetooth ||
        settings.autoSwitchInterface == true
      ) {
        var hasPermission = await _confirmBluetoothPermission();

        if (!hasPermission) {
          console.error(
            `PERMISSION ERROR: You have to allow Nearby devices to use the Bluetooth printer`,
          );
          return;
        }
      }
    }

    var printer = new StarPrinter(settings);

    try {
      // TSP100III series and TSP100IIU+ do not support actionPrintText because these products are graphics-only printers.
      // Please use the actionPrintImage method to create printing data for these products.
      // For other available methods, please also refer to "Supported Model" of each method.
      // https://www.star-m.jp/products/s_print/sdk/react-native-star-io10/manual/en/api-reference/star-xpand-command/printer-builder/action-print-image.html
      var builder = new StarXpandCommand.StarXpandCommandBuilder();
      builder.addDocument(
        new StarXpandCommand.DocumentBuilder()
          // To open a cash drawer, comment out the following code.
          .addDrawer(
            new StarXpandCommand.DrawerBuilder().actionOpen(
              new StarXpandCommand.Drawer.OpenParameter(),
            ),
          ),
      );

      var commands = await builder.getCommands();

      await printer.open();
      await printer.print(commands);
    } catch (error) {
      console.error(`Error: ${String(error)}`);
    } finally {
      await printer.close();
      await printer.dispose();
    }
  }

  async function _confirmBluetoothPermission(): Promise<boolean> {
    var hasPermission = false;

    try {
      hasPermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      );

      if (!hasPermission) {
        const status = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        );

        hasPermission = status == PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (err) {
      console.warn(err);
    }

    return hasPermission;
  }

  const onMessage = (event: any) => {
    const message: {
      action: 'print_order' | 'open_drawer' | 'test' | 'discovery';
      data: OrderProduct[];
      ip: string;
    } = JSON.parse(event.nativeEvent.data);
    if (!message) return;

    if (
      message.action == 'print_order' &&
      message.data.length > 0 &&
      message.ip &&
      message.ip !== ''
    ) {
      printOrder(message.data, message.ip);
    }

    if (message.action == 'open_drawer') {
      _onPressOpenCashDrawerButton();
    }

    if (message.action === 'test' && message.ip && message.ip !== '') {
      testPrint(message.ip);
    }

    if (message.action === 'discovery') {
      printerDiscovery();
    }
  };

  return (
    <WebView
      ref={webviewRef}
      source={{
        uri: '192.168.1.36',
      }}
      style={{flex: 1}}
      onMessage={onMessage}
      setSupportMultipleWindows={false}
    />
  );
}
